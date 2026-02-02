import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const LEAVE_TYPES = ["annual", "sick", "unpaid", "mission", "permission"] as const;
export const RULE_TYPES = ["custom_shift", "attendance_exempt", "penalty_override", "ignore_biometric", "overtime_overnight"] as const;
export const PENALTY_TYPES = ["late_arrival", "early_leave", "missing_stamp", "absence"] as const;

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  sector: text("sector"),
  department: text("department"),
  section: text("section"),
  jobTitle: text("job_title"),
  branch: text("branch"),
  governorate: text("governorate"),
  hireDate: text("hire_date"),
  terminationDate: text("termination_date"),
  terminationReason: text("termination_reason"),
  serviceDuration: text("service_duration"),
  directManager: text("direct_manager"),
  deptManager: text("dept_manager"),
  nationalId: text("national_id"),
  birthDate: text("birth_date"),
  address: text("address"),
  birthPlace: text("birth_place"),
  personalPhone: text("personal_phone"),
  emergencyPhone: text("emergency_phone"),
  shiftStart: text("shift_start").default("09:00"),
});

export const biometricPunches = pgTable("biometric_punches", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  punchDatetime: timestamp("punch_datetime").notNull(),
});

export const excelTemplates = pgTable("excel_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'attendance' or 'summary'
  mapping: jsonb("mapping").notNull(), // Column definitions
});

export const specialRules = pgTable("special_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priority: integer("priority").default(0),
  scope: text("scope").notNull(), // 'all', 'dept:Sales', 'emp:123'
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  ruleType: text("rule_type", { enum: RULE_TYPES }).notNull(),
  params: jsonb("params").notNull(),
});

export const adjustments = pgTable("adjustments", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  type: text("type", { enum: LEAVE_TYPES }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  notes: text("notes"),
});

// Storing calculated attendance for performance/audit
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  totalHours: doublePrecision("total_hours").default(0),
  overtimeHours: doublePrecision("overtime_hours").default(0),
  status: text("status"), // Present, Absent, Late, etc.
  penalties: jsonb("penalties"), // Array of penalty objects
  isOvernight: boolean("is_overnight").default(false),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  date: text("date").notNull(),
  action: text("action").notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Zod Schemas
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertPunchSchema = createInsertSchema(biometricPunches).omit({ id: true });
export const insertTemplateSchema = createInsertSchema(excelTemplates).omit({ id: true });
export const insertRuleSchema = createInsertSchema(specialRules).omit({ id: true });
export const insertAdjustmentSchema = createInsertSchema(adjustments).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true });

// Types
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Template = typeof excelTemplates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type SpecialRule = typeof specialRules.$inferSelect;
export type InsertSpecialRule = z.infer<typeof insertRuleSchema>;

export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = z.infer<typeof insertAdjustmentSchema>;

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceSchema>;

export type BiometricPunch = typeof biometricPunches.$inferSelect;
export type InsertBiometricPunch = z.infer<typeof insertPunchSchema>;
