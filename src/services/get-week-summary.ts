import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { goalCompletions, goals } from '../db/schema';
import dayjs from 'dayjs';

export async function getWeekSummary() {
  const firstDayOfWeek = dayjs().startOf('week').toDate();
  const lastDayOfWeek = dayjs().endOf('week').toDate();

  const goalsCreatedUpToThisWeek = db.$with('goals_created_up_to_this_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek))
  );

  const goalsCompletedInThisWeek = db.$with('goals_completed_in_this_week').as(
    db
      .select({
        id: goalCompletions.id,
        title: goals.title,
        completedAt: goalCompletions.createdAt,
        completedAtDate: sql`
            DATE(${goalCompletions.createdAt})
        `.as('completedAtDate'),
      })
      .from(goalCompletions)
      .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
      .orderBy(desc(goalCompletions.createdAt))
      .where(
        and(
          gte(goalCompletions.createdAt, firstDayOfWeek),
          lte(goalCompletions.createdAt, lastDayOfWeek)
        )
      )
  );

  const goalsCompletedByWeekDay = db.$with('goals_completed_by_week_day').as(
    db
      .select({
        completedAtDate: goalsCompletedInThisWeek.completedAtDate,
        completions: sql`
                JSON_AGG(JSON_BUILD_OBJECT(
                    'id', ${goalsCompletedInThisWeek.id},
                    'title', ${goalsCompletedInThisWeek.title},
                    'completedAt', ${goalsCompletedInThisWeek.completedAt}
                ))
            `.as('completions'),
      })
      .from(goalsCompletedInThisWeek)
      .groupBy(goalsCompletedInThisWeek.completedAtDate)
      .orderBy(desc(goalsCompletedInThisWeek.completedAtDate))
  );

  type GoalsPerDay = Record<
    string,
    {
      id: string;
      title: string;
      completedAt: string;
    }[]
  >;

  const result = await db
    .with(
      goalsCreatedUpToThisWeek,
      goalsCompletedInThisWeek,
      goalsCompletedByWeekDay
    )
    .select({
      completed:
        sql`(SELECT COUNT(*) FROM ${goalsCompletedInThisWeek})`.mapWith(Number),
      total:
        sql`(SELECT SUM(${goalsCreatedUpToThisWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToThisWeek})`.mapWith(
          Number
        ),
      goalsPerDay: sql<GoalsPerDay>`JSON_OBJECT_AGG(
        ${goalsCompletedByWeekDay.completedAtDate}, ${goalsCompletedByWeekDay.completions}
       )`,
    })
    .from(goalsCompletedByWeekDay);

  return {
    summary: result[0],
  };
}
