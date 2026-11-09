import { describe, expect, it } from 'vitest';
import { MAX_PASTE_CHARS, parseRecipeText } from './importText';
import promptFormat from './__fixtures__/paste/chatgpt-prompt-format.txt?raw';
import freeMarkdown from './__fixtures__/paste/chatgpt-free-markdown.txt?raw';
import instagram from './__fixtures__/paste/instagram-caption.txt?raw';
import noHeadings from './__fixtures__/paste/caption-no-headings.txt?raw';
import noSalt from './__fixtures__/paste/chatgpt-no-salt.txt?raw';

function ings(text: string) {
  return parseRecipeText(text).ingredients.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    optional: i.optional,
  }));
}

/** Parse a one-line ingredient list under a heading and return the first row. */
function one(line: string) {
  return ings(`Ingredients:\n- ${line}`)[0];
}

describe('fixtures', () => {
  it('ChatGPT reply in the prompt helper format', () => {
    const r = parseRecipeText(promptFormat);
    expect(r.title).toBe('Banana oat pancakes');
    expect(r.statedMinutes).toBe(15);
    expect(r.servings).toBe(2);
    expect(r.warnings).toEqual([]);
    expect(r.ingredients).toEqual([
      { name: 'ripe banana', quantity: 1, optional: false, line: 5 },
      { name: 'rolled oats', quantity: 0.25, unit: 'cup', optional: false, line: 6 },
      { name: 'egg', quantity: 1, optional: false, line: 7 },
      { name: 'olive oil', quantity: 1, unit: 'tsp', optional: true, line: 8 },
    ]);
    expect(r.steps.map((s) => s.text)).toEqual([
      'Mash the banana in a bowl until smooth.',
      'Stir in the oats and the egg.',
      'Heat the oil in a pan over low heat.',
      'Cook small spoonfuls for 2 minutes per side, then let cool before serving.',
    ]);
    expect(r.steps[0].line).toBe(10);
    expect(r.notes).toEqual([]);
  });

  it('ChatGPT reply in free markdown', () => {
    const r = parseRecipeText(freeMarkdown);
    expect(r.title).toBe('Sweet Potato and Lentil Mash');
    // Prep time 10 + Cook time 20.
    expect(r.statedMinutes).toBe(30);
    expect(r.servings).toBe(4);
    expect(r.warnings).toEqual([]);
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit, i.optional])).toEqual([
      ['medium sweet potato, peeled and diced', 1, undefined, false],
      ['red lentils', 0.5, 'cup', false],
      ['water', 1.5, 'cup', false],
      ['olive oil', 2, 'tbsp', false], // range 1-2 uses the upper bound
      ['cinnamon', undefined, 'pinch', false],
      ['chopped parsley', 1, 'tbsp', true],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual([
      'Boil the sweet potato and lentils in the water for 20 minutes.', // bold stripped
      'Drain, add the oil and mash until the texture is smooth.',
      'Stir in the cinnamon.',
    ]);
    // The intro sentence has a cooking word but headings exist, so it is a note.
    expect(r.notes.map((n) => n.text)).toEqual([
      'Here is a soft, iron-rich mash for a baby who is ready for thicker purees.',
      'Freeze in small portions.',
      'Reheat until steaming hot, then let it cool.',
      'Enjoy!',
    ]);
  });

  it('Instagram caption with emoji, hashtags and a one-line ingredient list', () => {
    const r = parseRecipeText(instagram);
    expect(r.title).toBe('Banana oat bites for baby-led weaning!');
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['ripe banana', 1, undefined],
      ['oats', 0.5, 'cup'],
      ['peanut butter', 1, 'tbsp'],
      ['cinnamon', undefined, 'pinch'],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual([
      'Mash the banana',
      'Stir in the oats and peanut butter',
      'Bake for 12 min at 350°F',
    ]);
    // "Save this", "Follow for", "Comment" and hashtag lines are gone.
    expect(r.notes).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('caption with no headings', () => {
    const r = parseRecipeText(noHeadings);
    expect(r.title).toBe('Easy pear and oat mash for 6 months+');
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['ripe pear', 1, undefined],
      ['rolled oats', 2, 'tbsp'],
      ['water', 0.25, 'cup'],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual([
      'Peel and chop the pear. Cook it with the water until soft. Stir in the oats and mash.',
      'Serve warm.',
    ]);
    expect(r.notes.map((n) => n.text)).toEqual(['Perfect for lunch boxes!']);
  });

  it('reply that mentions "no salt" in a step keeps the sentence as written', () => {
    const r = parseRecipeText(noSalt);
    expect(r.title).toBe('Apple oat porridge');
    expect(r.steps.map((s) => s.text)).toContain('Stir in the apple. Do not add salt.');
    expect(r.ingredients.map((i) => i.name)).toEqual(['rolled oats', 'water', 'apple, grated']);
  });
});

describe('clean-up', () => {
  it('normalizes line endings and keeps 1-based original line numbers', () => {
    const r = parseRecipeText('Title: A\r\n\r\nIngredients:\r\n- 1 egg\r- 2 cups milk\nSteps:\n1. Mix.');
    expect(r.ingredients.map((i) => i.line)).toEqual([4, 5]);
    expect(r.steps[0].line).toBe(7);
  });

  it('strips markdown headers, bold, italic and code ticks', () => {
    const r = parseRecipeText(
      '## **Ingredients**\n- *1* `egg`\n- __2__ **cups** milk\n## Steps\n1. **Mix** it',
    );
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['egg', 1, undefined],
      ['milk', 2, 'cup'],
    ]);
    expect(r.steps[0].text).toBe('Mix it');
  });

  it('strips emoji and decorative symbols but keeps unicode fractions', () => {
    const r = parseRecipeText('Ingredients:\n🍌 ½ cup oats ✨\n⭐ ¼ tsp cinnamon\n━━━━━━\n→ 1 egg');
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['oats', 0.5, 'cup'],
      ['cinnamon', 0.25, 'tsp'],
      ['egg', 1, undefined],
    ]);
  });

  it('turns keycap emoji into numbered steps', () => {
    const r = parseRecipeText('Steps:\n1️⃣ Mash\n2️⃣ Stir');
    expect(r.steps.map((s) => s.text)).toEqual(['Mash', 'Stir']);
  });

  it('drops hashtag and @mention lines and trailing hashtag runs', () => {
    const r = parseRecipeText(
      'Steps:\n#baby #food @brand\nMash the banana #yum #baby @me\n1. Stir well #tips',
    );
    expect(r.steps.map((s) => s.text)).toEqual(['Mash the banana', 'Stir well']);
    expect(r.notes).toEqual([]);
  });

  it.each([
    'Save this recipe for later',
    'Follow for more ideas',
    'Link in bio for the full recipe',
    'Comment YES and I will send it',
    'Share with a friend',
    'Tag a mom who needs this',
  ])('drops the caption filler line "%s"', (line) => {
    const r = parseRecipeText(`Ingredients:\n- 1 egg\nSteps:\n1. Mix\n${line}`);
    expect(r.steps.map((s) => s.text)).toEqual(['Mix']);
    expect(r.notes).toEqual([]);
  });

  it('does not drop lines that only contain similar words', () => {
    const r = parseRecipeText('Steps:\n1. Mix\n2. Recommended: stir twice');
    expect(r.steps).toHaveLength(2);
  });
});

describe('sections and title', () => {
  it.each([
    ['Ingredients'],
    ['What you need'],
    ["What you'll need"],
    ['You will need'],
    ["You'll need"],
    ['What you’ll need'],
  ])('reads the ingredient heading "%s" (with or without a colon, any case)', (heading) => {
    for (const h of [heading, `${heading}:`, heading.toUpperCase(), `**${heading}:**`]) {
      expect(ings(`${h}\n- 1 egg`).map((i) => i.name)).toEqual(['egg']);
    }
  });

  it.each([
    ['Instructions'],
    ['Steps'],
    ['Method'],
    ['Directions'],
    ['How to make'],
    ['How to make it'],
    ['Preparation'],
  ])('reads the step heading "%s"', (heading) => {
    const r = parseRecipeText(`${heading}:\nMix it\nBake it`);
    expect(r.steps.map((s) => s.text)).toEqual(['Mix it', 'Bake it']);
  });

  it.each([['Notes'], ['Tips'], ['Storage'], ['Serving']])('reads the notes heading "%s"', (heading) => {
    const r = parseRecipeText(`${heading}:\nKeeps 3 days`);
    expect(r.notes.map((n) => n.text)).toEqual(['Keeps 3 days']);
  });

  it('lets a heading share its line with content', () => {
    const r = parseRecipeText('Ingredients: 1 banana, 2 tbsp oats\nMethod: Mash and stir\nTips: Freeze it');
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['banana', 1, undefined],
      ['oats', 2, 'tbsp'],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual(['Mash and stir']);
    expect(r.notes.map((n) => n.text)).toEqual(['Freeze it']);
  });

  it('allows a parenthetical after a heading', () => {
    expect(ings('Ingredients (serves 2):\n- 1 egg').map((i) => i.name)).toEqual(['egg']);
  });

  it('keeps sections open across blank lines', () => {
    const r = parseRecipeText('## Ingredients\n\n- 1 egg\n\n- 1 banana\n\n## Steps\n\n1. Mix');
    expect(r.ingredients).toHaveLength(2);
    expect(r.steps).toHaveLength(1);
  });

  it('puts closing chatter after the steps into notes', () => {
    const r = parseRecipeText('Steps:\n1. Mix it\n\nEnjoy your meal!');
    expect(r.steps.map((s) => s.text)).toEqual(['Mix it']);
    expect(r.notes.map((n) => n.text)).toEqual(['Enjoy your meal!']);
  });

  it('puts sub-headings in an ingredient list into notes', () => {
    const r = parseRecipeText('Ingredients:\nFor the sauce:\n- 1 tomato');
    expect(r.ingredients.map((i) => i.name)).toEqual(['tomato']);
    expect(r.notes.map((n) => n.text)).toEqual(['For the sauce:']);
  });

  it('uses a Title: line anywhere, over the first line', () => {
    const r = parseRecipeText('Hello there\nTitle: Pear mash\nIngredients:\n- 1 pear');
    expect(r.title).toBe('Pear mash');
    expect(r.notes.map((n) => n.text)).toEqual(['Hello there']);
  });

  it('uses the first line before the first heading when it is under 80 characters', () => {
    expect(parseRecipeText('Pear mash\nIngredients:\n- 1 pear').title).toBe('Pear mash');
    expect(parseRecipeText('5-minute pear mash\nIngredients:\n- 1 pear').title).toBe('5-minute pear mash');
  });

  it('falls back to "Pasted recipe"', () => {
    const long = 'x'.repeat(80);
    expect(parseRecipeText(`${long}\nIngredients:\n- 1 pear`).title).toBe('Pasted recipe');
    expect(parseRecipeText('- a bullet first\nIngredients:\n- 1 pear').title).toBe('Pasted recipe');
    expect(parseRecipeText('Ingredients:\n- 1 pear').title).toBe('Pasted recipe');
    expect(parseRecipeText('1 cup oats\n2 tbsp milk').title).toBe('Pasted recipe');
    expect(parseRecipeText('Total time: 5 min\nIngredients:\n- 1 pear').title).toBe('Pasted recipe');
  });

  it('keeps an 79-character first line as the title', () => {
    const t = 'y'.repeat(79);
    expect(parseRecipeText(`${t}\nIngredients:\n- 1 pear`).title).toBe(t);
  });
});

describe('time and servings', () => {
  const minutes = (text: string) => parseRecipeText(text).statedMinutes;

  it('reads Total time and Ready in', () => {
    expect(minutes('Total time: 20 minutes')).toBe(20);
    expect(minutes('Ready in 45 mins')).toBe(45);
    expect(minutes('Total time: 5')).toBe(5);
  });

  it('prefers Total time over the other labels', () => {
    expect(minutes('Prep time: 5 min\nCook time: 5 min\nTotal time: 30 min')).toBe(30);
  });

  it('sums Prep time and Cook time, and ignores one of them alone', () => {
    expect(minutes('Prep time: 10 min\nCook time: 15 min')).toBe(25);
    expect(minutes('Prep time: 5 min | Cook time: 10 min')).toBe(15);
    expect(minutes('Cook time: 15 min')).toBeUndefined();
  });

  it('reads hours, mixed hours and minutes, decimals and ranges', () => {
    expect(minutes('Total time: 1 hour')).toBe(60);
    expect(minutes('Total time: 1 hr 30 min')).toBe(90);
    expect(minutes('Total time: 1 hour 15 minutes')).toBe(75);
    expect(minutes('Total time: 1.5 hours')).toBe(90);
    expect(minutes('Total time: 1h30')).toBe(90);
    expect(minutes('Total time: 20-25 minutes')).toBe(25);
  });

  it('does not make a time line out of an unreadable value', () => {
    const r = parseRecipeText('Ingredients:\n- 1 egg\nTotal time: soon');
    expect(r.statedMinutes).toBeUndefined();
    expect(r.ingredients.map((i) => i.name)).toContain('Total time: soon');
  });

  it('keeps time and servings lines out of the lists', () => {
    const r = parseRecipeText('Ingredients:\n- 1 egg\nTotal time: 5 min\nServes: 2\nSteps:\n1. Mix');
    expect(r.ingredients).toHaveLength(1);
    expect(r.notes).toEqual([]);
  });

  it.each([
    ['Serves 4', 4],
    ['Serves: 2-3', 3],
    ['Servings: 6', 6],
    ['Makes 4 servings', 4],
    ['Makes about 8 servings', 8],
    ['Yield: 12', 12],
    ['Serving: 2', 2],
  ])('reads servings from "%s"', (line, n) => {
    expect(parseRecipeText(`${line}\nIngredients:\n- 1 egg`).servings).toBe(n);
  });

  it('does not read servings from other lines', () => {
    expect(parseRecipeText('Makes a great snack').servings).toBeUndefined();
    expect(parseRecipeText('Notes:\nServing: 1 tbsp at a time').servings).toBeUndefined();
    expect(parseRecipeText('Serves: 0\nIngredients:\n- 1 egg').servings).toBeUndefined();
  });
});

describe('list markers', () => {
  it.each([['- '], ['* '], ['• '], ['▪ '], ['– '], ['1. '], ['1) '], ['Step 1: ']])(
    'strips the marker "%s" from a step',
    (marker) => {
      expect(parseRecipeText(`Steps:\n${marker}Mash it`).steps[0].text).toBe('Mash it');
    },
  );

  it('strips markers from ingredient lines', () => {
    expect(ings('Ingredients:\n• 1 egg\n▪ 2 tbsp milk').map((i) => i.name)).toEqual(['egg', 'milk']);
  });
});

describe('inline ingredient lists', () => {
  it('splits on commas and "and" when every piece is under 6 words', () => {
    expect(ings('Ingredients: 1 banana, 2 tbsp oats and a pinch of cinnamon').map((i) => i.name)).toEqual([
      'banana',
      'oats',
      'a pinch of cinnamon',
    ]);
  });

  it('keeps the list as one line when a piece has 6 words or more', () => {
    const r = parseRecipeText('Ingredients: 1 banana, 2 tbsp of very finely ground oats');
    expect(r.ingredients).toHaveLength(1);
  });

  it('accepts pieces of exactly 5 words', () => {
    expect(ings('Ingredients: one two three four five, six seven eight nine ten')).toHaveLength(2);
  });
});

describe('ingredient lines', () => {
  it.each([
    ['2 eggs', 2],
    ['1.5 cups milk', 1.5],
    ['1/2 cup milk', 0.5],
    ['½ cup milk', 0.5],
    ['¼ cup milk', 0.25],
    ['¾ cup milk', 0.75],
    ['⅓ cup milk', 0.333],
    ['⅔ cup milk', 0.667],
    ['1 1/2 cups milk', 1.5],
    ['1½ cups milk', 1.5],
    ['1 ½ cups milk', 1.5],
    ['1-2 cups milk', 2],
    ['1 to 2 cups milk', 2],
    ['1–2 cups milk', 2],
    ['1/2-1 cup milk', 1],
  ])('reads the quantity in "%s"', (line, quantity) => {
    expect(one(line).quantity).toBe(quantity);
  });

  it('has no quantity when the line does not start with one', () => {
    expect(one('Olive oil').quantity).toBeUndefined();
    expect(one('2-inch piece of ginger').quantity).toBeUndefined();
    expect(one('1/0 cup milk').quantity).toBeUndefined();
  });

  it.each([
    ['1 cup oats', 'cup', 'oats'],
    ['2 cups oats', 'cup', 'oats'],
    ['2 tbsp oats', 'tbsp', 'oats'],
    ['2 tablespoons oats', 'tbsp', 'oats'],
    ['1 tsp. cinnamon', 'tsp', 'cinnamon'],
    ['1 teaspoon cinnamon', 'tsp', 'cinnamon'],
    ['200 g flour', 'g', 'flour'],
    ['200g flour', 'g', 'flour'],
    ['2tbsp oil', 'tbsp', 'oil'],
    ['100 ml milk', 'ml', 'milk'],
    ['8 oz tofu', 'oz', 'tofu'],
    ['1 lb chicken', 'lb', 'chicken'],
    ['2 cloves garlic', 'clove', 'garlic'],
    ['2 slices bread', 'slice', 'bread'],
    ['1 can black beans', 'can', 'black beans'],
    ['1 jar tomato sauce', 'jar', 'tomato sauce'],
    ['1 pinch cinnamon', 'pinch', 'cinnamon'],
    ['1 handful spinach', 'handful', 'spinach'],
    ['3 pieces chicken', 'piece', 'chicken'],
    ['1 cup of milk', 'cup', 'milk'],
  ])('reads the unit in "%s"', (line, unit, name) => {
    const row = one(line);
    expect(row.unit).toBe(unit);
    expect(row.name).toBe(name);
  });

  it('reads a unit without a quantity for pinch, handful and "of"', () => {
    expect(one('Pinch of cinnamon')).toMatchObject({ unit: 'pinch', name: 'cinnamon', quantity: undefined });
    expect(one('Handful spinach')).toMatchObject({ unit: 'handful', name: 'spinach' });
    expect(one('Can of beans')).toMatchObject({ unit: 'can', name: 'beans' });
    expect(one('Cup cakes')).toMatchObject({ unit: undefined, name: 'Cup cakes' });
  });

  it('leaves a word that is not a unit in the name', () => {
    expect(one('2 large eggs')).toMatchObject({ quantity: 2, unit: undefined, name: 'large eggs' });
  });

  it('never leaves the name empty', () => {
    expect(one('2 cups').name).toBe('cups');
  });

  it('keeps the rest of the line as the name so the safety screen sees all of it', () => {
    expect(one('1 tbsp honey, drizzled').name).toBe('honey, drizzled');
    expect(one('Salt, a pinch').name).toBe('Salt, a pinch');
  });

  it.each([
    ['1 banana (optional)'],
    ['1 banana, optional'],
    ['1 banana optional'],
    ['1 banana if you like'],
    ['1 banana, to taste'],
    ['1 banana (to taste)'],
  ])('flags "%s" as optional and removes the marker from the name', (line) => {
    expect(one(line)).toMatchObject({ optional: true, name: 'banana' });
  });

  it('keeps salt "to taste" as an ingredient name for the safety screen', () => {
    expect(one('Salt to taste')).toMatchObject({ optional: true, name: 'Salt' });
  });

  it('marks other ingredients as not optional', () => {
    expect(one('1 banana').optional).toBe(false);
  });
});

describe('sections without headings (captions)', () => {
  it('reads consecutive short quantity, unit or bulleted lines as the ingredient list', () => {
    const r = parseRecipeText('Pear mash\n1 pear\nPinch of cinnamon\n- oats\nMash the pear');
    expect(r.ingredients.map((i) => i.name)).toEqual(['pear', 'cinnamon', 'oats']);
    expect(r.steps.map((s) => s.text)).toEqual(['Mash the pear']);
  });

  it('does not read a line of 8 words or more as an ingredient', () => {
    const r = parseRecipeText('Pear mash\n1 pear\n2 tbsp oats\n1 very ripe pear that was left on the counter');
    expect(r.ingredients.map((i) => i.name)).toEqual(['pear', 'oats']);
    expect(r.notes.map((n) => n.text)).toEqual(['1 very ripe pear that was left on the counter']);
  });

  it('ends an ingredient list at a blank line', () => {
    const r = parseRecipeText('Pear mash\n1 pear\n2 tbsp oats\n\n1 cup water');
    expect(r.ingredients.map((i) => i.name)).toEqual(['pear', 'oats', 'water']);
  });

  it('reads numbered lines and lines with a cooking verb as steps', () => {
    const r = parseRecipeText('Pear mash\n1. Wash the pear\nThen add water and stir\nBake until soft');
    expect(r.steps.map((s) => s.text)).toEqual(['Wash the pear', 'Then add water and stir', 'Bake until soft']);
  });

  it.each(['add', 'mix', 'stir', 'cook', 'bake', 'steam', 'boil', 'blend', 'mash', 'serve', 'heat', 'combine', 'pour', 'cut', 'chop'])(
    'treats a sentence with the verb "%s" as a step',
    (verb) => {
      const r = parseRecipeText(`Pear mash\nNow ${verb} the pear until it is nice and soft`);
      expect(r.steps).toHaveLength(1);
    },
  );

  it('reads everything else as notes', () => {
    const r = parseRecipeText('Pear mash\nGreat for a lazy afternoon');
    expect(r.notes.map((n) => n.text)).toEqual(['Great for a lazy afternoon']);
  });

  it('does not take a time phrase or a short sentence starting with "can" as an ingredient', () => {
    const r = parseRecipeText('Pear mash\n10 minutes in the pot\nCan be frozen');
    expect(r.ingredients).toEqual([]);
    expect(r.notes).toHaveLength(2);
  });

  it('keeps a lone line with a quantity and a unit as an ingredient', () => {
    const r = parseRecipeText('Pear mash\n1 cup oats\nMash it');
    expect(r.ingredients.map((i) => i.name)).toEqual(['oats']);
  });

  it('does not take a lone bullet note as an ingredient list', () => {
    const r = parseRecipeText('Pear mash\n- lovely stuff\nMash it');
    expect(r.ingredients).toEqual([]);
    expect(r.notes.map((n) => n.text)).toEqual(['lovely stuff']);
  });
});

describe('warnings and limits', () => {
  it('warns when there are no ingredients', () => {
    const r = parseRecipeText('Steps:\n1. Mix');
    expect(r.warnings).toContain('No ingredient list found');
    expect(r.ingredients).toEqual([]);
  });

  it('warns when there are no steps', () => {
    expect(parseRecipeText('Ingredients:\n- 1 egg').warnings).toEqual(['No steps found']);
  });

  it('returns an empty recipe for empty or whitespace text', () => {
    for (const t of ['', '   \n  ']) {
      const r = parseRecipeText(t);
      expect(r).toMatchObject({ title: 'Pasted recipe', ingredients: [], steps: [], notes: [] });
      expect(r.warnings).toHaveLength(1);
    }
  });

  it('does not parse text over 20,000 characters, but parses exactly 20,000', () => {
    const body = 'Ingredients:\n- 1 egg\n';
    const over = parseRecipeText(body + 'x'.repeat(MAX_PASTE_CHARS));
    expect(over.ingredients).toEqual([]);
    expect(over.warnings[0]).toMatch(/too long/);
    const exact = parseRecipeText(body + ' '.repeat(MAX_PASTE_CHARS - body.length));
    expect(exact.ingredients).toHaveLength(1);
  });

  it('keeps every unrecognized line in notes so nothing disappears silently', () => {
    const r = parseRecipeText('Notes:\nAdd a spoon of honey at the end');
    expect(r.notes.map((n) => n.text)).toEqual(['Add a spoon of honey at the end']);
  });
});
