import { z } from "zod";

// Validation schemas
export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  persona: z.enum(["founder", "agency", "team", "enterprise"]).optional(),
  goal: z.string().max(500).optional(),
});

export const demoSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  company: z.string().min(1, "Company name is required"),
  useCase: z.enum(["mvp", "agency-projects", "internal-tools", "microsites", "other"]),
  message: z.string().max(1000).optional(),
});

export type SignupData = z.infer<typeof signupSchema>;
export type DemoData = z.infer<typeof demoSchema>;

export async function submitSignup(data: SignupData): Promise<{ success: boolean; error?: string; id?: string }> {
  const result = signupSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  // In static export mode, log to console
  // TODO: Integrate with Firebase or API endpoint
  console.log("[Signup]", result.data);
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, id };
}

export async function submitDemo(data: DemoData): Promise<{ success: boolean; error?: string; id?: string }> {
  const result = demoSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  // In static export mode, log to console
  // TODO: Integrate with Firebase or API endpoint
  console.log("[Demo Request]", result.data);
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, id };
}
