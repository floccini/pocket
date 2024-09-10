import { db } from '../db';
import { goals } from '../db/schema';

interface CreateGoalDTO {
  title: string;
  desiredWeeklyFrequency: number;
}

export async function createGoal(request: CreateGoalDTO) {
  const result = await db.insert(goals).values(request).returning();

  const goal = result[0];

  return {
    goal,
  };
}
