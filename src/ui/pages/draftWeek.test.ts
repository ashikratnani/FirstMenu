import { describe, expect, it } from 'vitest';
import { defaultState } from '../../domain/storage';
import type { AppState, FoodRecord, Recipe } from '../../domain/types';
import { draftWeek } from './draftWeek';

function recipe(id: string, food: string, mealTypes: Recipe['mealTypes'] = ['breakfast']): Recipe {
  return {
    id,
    origin: 'custom',
    title: `${food} dish`,
    stages: ['6-8', '9-12'],
    mealTypes,
    ingredients: [{ name: food, category: 'produce' }],
    steps: ['Cook.'],
    texture: 'smooth',
    servings: 1,
  };
}

function stateWith(foods: Record<string, FoodRecord> = {}, activeSlots: AppState['plan']['activeSlots'] = ['breakfast']): AppState {
  const base = defaultState(new Date('2026-01-05'));
  return {
    ...base,
    child: { birthDate: '2025-06-05' }, // 7 months
    foods,
    plan: { ...base.plan, activeSlots, days: Array.from({ length: 7 }, () => ({})) },
  };
}

const tried = (): FoodRecord => ({ status: 'tried', date: '2026-01-01' });

describe('draftWeek', () => {
  it('fills only empty active slots and keeps existing ones', () => {
    const state = stateWith({ pear: tried() });
    state.plan.days[0] = { breakfast: 'keep-me', lunch: 'other' };
    const { plan, added } = draftWeek(state, [recipe('a', 'pear')]);
    expect(plan.days[0].breakfast).toBe('keep-me');
    expect(plan.days[0].lunch).toBe('other');
    expect(plan.days[1].breakfast).toBe('a');
    expect(plan.days.every((d) => d.dinner === undefined)).toBe(true);
    expect(added).toHaveLength(6);
    expect(added.some((a) => a.day === 0)).toBe(false);
  });

  it('prefers recipes whose foods are already tried', () => {
    const state = stateWith({ pear: tried() });
    const { plan } = draftWeek(state, [recipe('new', 'mango'), recipe('old', 'pear')]);
    expect(plan.days[0].breakfast).toBe('old');
    expect(plan.days[1].breakfast).toBe('new');
  });

  it('never uses a ghosted candidate', () => {
    const state = stateWith({ pear: { status: 'reaction', date: '2026-01-01' }, apple: tried() });
    const { plan } = draftWeek(state, [recipe('bad', 'pear'), recipe('ok', 'apple')]);
    expect(plan.days.every((d) => d.breakfast === 'ok')).toBe(true);
  });

  it('leaves a slot empty when nothing is eligible', () => {
    const { plan, added } = draftWeek(stateWith(), [recipe('x', 'pear', ['dinner'])]);
    expect(added).toEqual([]);
    expect(plan.days.every((d) => d.breakfast === undefined)).toBe(true);
  });

  it('uses the stage defaults when the plan has no active slots', () => {
    const state = stateWith({ pear: tried() }, []);
    const { plan } = draftWeek(state, [recipe('a', 'pear', ['breakfast', 'dinner'])]);
    expect(plan.activeSlots).toEqual(['breakfast', 'dinner']);
    expect(plan.days[0].breakfast).toBe('a');
    expect(plan.days[0].dinner).toBe('a');
  });

  it('is deterministic and does not change the input state', () => {
    const state = stateWith({ pear: tried(), apple: tried() });
    const recipes = [recipe('a', 'pear'), recipe('b', 'apple')];
    const before = JSON.stringify(state);
    expect(draftWeek(state, recipes)).toEqual(draftWeek(state, recipes));
    expect(JSON.stringify(state)).toBe(before);
  });
});
