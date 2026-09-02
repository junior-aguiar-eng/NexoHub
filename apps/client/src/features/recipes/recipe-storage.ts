import type { RecipeSnapshot } from "@nexohub/domain";

const STORAGE_KEY = "nexohub.recipes.v1";

export interface RecipeStoragePort {
  save(recipe: RecipeSnapshot): Promise<void>;
  list(): Promise<readonly RecipeSnapshot[]>;
}

export class BrowserRecipeStorage implements RecipeStoragePort {
  async save(recipe: RecipeSnapshot): Promise<void> {
    const recipes = await this.list();
    const next = [...recipes.filter((item) => item.id !== recipe.id), recipe];
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async list(): Promise<readonly RecipeSnapshot[]> {
    const serialized = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return [];
    try {
      const parsed: unknown = JSON.parse(serialized);
      return Array.isArray(parsed) ? (parsed as RecipeSnapshot[]) : [];
    } catch {
      return [];
    }
  }
}

export const browserRecipeStorage = new BrowserRecipeStorage();
