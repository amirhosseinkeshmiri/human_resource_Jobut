import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobPosts } from "@/db/schema";

export async function getCompanyJobPosts(companyId: string) {
  return db.select({
    id: jobPosts.id,
    title: jobPosts.title,
    status: jobPosts.status,
    createdAt: jobPosts.createdAt,
    updatedAt: jobPosts.updatedAt,
  }).from(jobPosts).where(eq(jobPosts.companyId, companyId)).orderBy(desc(jobPosts.createdAt));
}

export async function getCompanyJobPost(companyId: string, jobId: string) {
  const [job] = await db.select({
    id: jobPosts.id,
    companyId: jobPosts.companyId,
    title: jobPosts.title,
    status: jobPosts.status,
    createdAt: jobPosts.createdAt,
    updatedAt: jobPosts.updatedAt,
  }).from(jobPosts).where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId))).limit(1);
  return job ?? null;
}
