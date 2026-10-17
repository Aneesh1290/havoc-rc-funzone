"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getAdminUserByUsername, initDB, updateAdminPassword } from "@/lib/db";
import { signToken, verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

// Ensure DB is initialized
initDB();

// Simple in-memory rate limiting to defend against brute-force attacks
const loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt) return { allowed: true };

  if (attempt.lockedUntil > now) {
    const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset window if lock has passed
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  attempt.count += 1;

  // After 5 consecutive failed attempts, lock for 5 minutes (300,000ms)
  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 5 * 60 * 1000;
  }

  loginAttempts.set(key, attempt);
}

function resetAttempts(key: string) {
  loginAttempts.delete(key);
}

export async function loginAction(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  // Strict input validation
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return { error: "Username and password are required" };
  }

  const cleanUsername = username.trim();
  const cleanPassword = password;

  if (cleanUsername.length === 0 || cleanUsername.length > 50) {
    return { error: "Invalid username format" };
  }

  if (cleanPassword.length === 0 || cleanPassword.length > 100) {
    return { error: "Invalid password format" };
  }

  // Rate limiting check
  const rateLimitKey = cleanUsername.toLowerCase();
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return { 
      error: `Too many failed attempts. Account temporarily locked for security. Please try again in ${rateCheck.waitSeconds}s.` 
    };
  }

  // Parameterized database lookup (protects against SQL Injection)
  const admin = getAdminUserByUsername(cleanUsername);

  if (!admin) {
    // Record failure and execute dummy comparison to mitigate timing attacks
    recordFailedAttempt(rateLimitKey);
    await bcrypt.compare("dummy_pass", "$2b$10$dummyHashToPreventTimingAttacks12345678901234567890");
    return { error: "Invalid username or password" };
  }

  // Verify password with bcrypt against hashed password stored in database
  const passwordMatches = await bcrypt.compare(cleanPassword, admin.password_hash);

  if (!passwordMatches) {
    recordFailedAttempt(rateLimitKey);
    return { error: "Invalid username or password" };
  }

  // Successful authentication - reset failed attempts
  resetAttempts(rateLimitKey);

  // Generate cryptographically signed HMAC-SHA256 JWT token
  const token = signToken({
    userId: admin.id,
    username: admin.username,
    role: admin.role,
  });

  // Set hardened HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect("/login");
}

export async function checkSessionAction() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME);
  if (!tokenCookie) return null;

  return verifyToken(tokenCookie.value);
}

export async function changePasswordAction(formData: FormData) {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME);
  if (!tokenCookie) return { error: "Unauthorized" };

  const session = verifyToken(tokenCookie.value);
  if (!session) return { error: "Unauthorized session expired" };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match" };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters long" };
  }

  const admin = getAdminUserByUsername(session.username);
  if (!admin) return { error: "User not found" };

  const matches = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!matches) {
    return { error: "Current password is incorrect" };
  }

  // Hash new password using bcrypt salt rounds = 10
  const newHash = await bcrypt.hash(newPassword, 10);
  updateAdminPassword(session.username, newHash);

  return { success: true };
}
