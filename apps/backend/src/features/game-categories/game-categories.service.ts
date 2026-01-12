import { GameCategory, IGameCategory } from './game-category.model';
import mongoose from 'mongoose';

export class GameCategoriesService {
  /**
   * Get all categories for a user
   */
  static async getUserCategories(userId: string): Promise<IGameCategory[]> {
    return await GameCategory.find({ user_id: userId }).sort({ created_at: -1 });
  }

  /**
   * Create a new category
   */
  static async createCategory(
    userId: string,
    name: string,
    icon: string = '📁'
  ): Promise<IGameCategory> {
    const category = new GameCategory({
      user_id: userId,
      name,
      icon,
    });
    return await category.save();
  }

  /**
   * Delete a category
   */
  static async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    const result = await GameCategory.deleteOne({
      _id: categoryId,
      user_id: userId, // Ensure user owns this category
    });
    return result.deletedCount > 0;
  }

  /**
   * Assign a game to a category
   */
  static async assignGame(
    userId: string,
    categoryId: string,
    gameKey: string
  ): Promise<IGameCategory> {
    const category = await GameCategory.findOne({
      _id: categoryId,
      user_id: userId,
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Add game if not already in category
    if (!category.games.includes(gameKey)) {
      category.games.push(gameKey);
      await category.save();
    }

    return category;
  }

  /**
   * Remove a game from a category
   */
  static async removeGame(
    userId: string,
    categoryId: string,
    gameKey: string
  ): Promise<IGameCategory> {
    const category = await GameCategory.findOne({
      _id: categoryId,
      user_id: userId,
    });

    if (!category) {
      throw new Error('Category not found');
    }

    category.games = category.games.filter((g) => g !== gameKey);
    await category.save();

    return category;
  }

  /**
   * Update category (name, icon)
   */
  static async updateCategory(
    userId: string,
    categoryId: string,
    updates: Partial<{ name: string; icon: string }>
  ): Promise<IGameCategory> {
    const category = await GameCategory.findOneAndUpdate(
      { _id: categoryId, user_id: userId },
      { $set: updates },
      { new: true }
    );

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }
}
