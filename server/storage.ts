import { 
  employees, type Employee, type InsertEmployee,
  biometricPunches, type BiometricPunch, type InsertBiometricPunch,
  excelTemplates, type Template, type InsertTemplate,
  specialRules, type SpecialRule, type InsertSpecialRule,
  adjustments, type Adjustment, type InsertAdjustment,
  attendanceRecords, type AttendanceRecord, type InsertAttendanceRecord
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, inArray, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByCode(code: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;

  // Templates
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;

  // Rules
  getRules(): Promise<SpecialRule[]>;
  createRule(rule: InsertSpecialRule): Promise<SpecialRule>;
  deleteRule(id: number): Promise<void>;

  // Adjustments
  getAdjustments(): Promise<Adjustment[]>;
  createAdjustment(adjustment: InsertAdjustment): Promise<Adjustment>;

  // Punches
  createPunch(punch: InsertBiometricPunch): Promise<BiometricPunch>;
  getPunches(startDate: Date, endDate: Date, employeeCode?: string): Promise<BiometricPunch[]>;

  // Attendance
  getAttendance(startDate: string, endDate: string, employeeCode?: string, limit?: number, offset?: number): Promise<{ data: AttendanceRecord[], total: number }>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: number, record: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord>;
  
  // Bulk operations for import
  createEmployeesBulk(employees: InsertEmployee[]): Promise<Employee[]>;
  createPunchesBulk(punches: InsertBiometricPunch[]): Promise<BiometricPunch[]>;

  // Maintenance
  wipeAllData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async wipeAllData(): Promise<void> {
    await db.delete(attendanceRecords);
    await db.delete(adjustments);
    await db.delete(specialRules);
    await db.delete(biometricPunches);
    await db.delete(employees);
    await db.delete(excelTemplates);
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getEmployeeByCode(code: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.code, code));
    return employee;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: number, update: Partial<InsertEmployee>): Promise<Employee> {
    const [employee] = await db.update(employees).set(update).where(eq(employees.id, id)).returning();
    return employee;
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    return await db.select().from(excelTemplates);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(excelTemplates).values(insertTemplate).returning();
    return template;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(excelTemplates).where(eq(excelTemplates.id, id));
  }

  // Rules
  async getRules(): Promise<SpecialRule[]> {
    return await db.select().from(specialRules);
  }

  async createRule(insertRule: InsertSpecialRule): Promise<SpecialRule> {
    const [rule] = await db.insert(specialRules).values(insertRule).returning();
    return rule;
  }

  async deleteRule(id: number): Promise<void> {
    await db.delete(specialRules).where(eq(specialRules.id, id));
  }

  // Adjustments
  async getAdjustments(): Promise<Adjustment[]> {
    return await db.select().from(adjustments);
  }

  async createAdjustment(insertAdjustment: InsertAdjustment): Promise<Adjustment> {
    const [adj] = await db.insert(adjustments).values(insertAdjustment).returning();
    return adj;
  }

  // Punches
  async createPunch(insertPunch: InsertBiometricPunch): Promise<BiometricPunch> {
    const [punch] = await db.insert(biometricPunches).values(insertPunch).returning();
    return punch;
  }

  async getPunches(startDate: Date, endDate: Date, employeeCode?: string): Promise<BiometricPunch[]> {
    let query = db.select().from(biometricPunches).where(
      and(
        gte(biometricPunches.punchDatetime, startDate),
        lte(biometricPunches.punchDatetime, endDate)
      )
    );
    
    if (employeeCode) {
      query = db.select().from(biometricPunches).where(
        and(
          gte(biometricPunches.punchDatetime, startDate),
          lte(biometricPunches.punchDatetime, endDate),
          eq(biometricPunches.employeeCode, employeeCode)
        )
      );
    }
    
    return await query;
  }

  // Attendance
  async getAttendance(startDate: string, endDate: string, employeeCode?: string, limit: number = 0, offset: number = 0): Promise<{ data: AttendanceRecord[], total: number }> {
    let conditions = [gte(attendanceRecords.date, startDate), lte(attendanceRecords.date, endDate)];
    if (employeeCode) {
      if (employeeCode.includes(',')) {
        const codes = employeeCode.split(',').map(c => c.trim()).filter(c => c !== "");
        if (codes.length > 0) {
          conditions.push(inArray(attendanceRecords.employeeCode, codes));
        }
      } else {
        conditions.push(eq(attendanceRecords.employeeCode, employeeCode.trim()));
      }
    }
    
    const [countResult] = await db.select({ 
      count: sql<number>`count(*)` 
    }).from(attendanceRecords).where(and(...conditions));

    let dataQuery = db.select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.id));
    
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
    const safeOffset = safeLimit > 0 && Number.isFinite(offset) && offset > 0 ? offset : 0;

    const data = safeLimit > 0 
      ? await baseQuery.limit(safeLimit).offset(safeOffset)
      : await baseQuery;

    return { data, total: Number(countResult?.count || 0) };
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    // Check if record already exists to avoid duplicates
    const [existing] = await db.select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeCode, insertRecord.employeeCode),
          eq(attendanceRecords.date, insertRecord.date)
        )
      );

    if (existing) {
      const [updated] = await db.update(attendanceRecords)
        .set(insertRecord)
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      return updated;
    }

    const [record] = await db.insert(attendanceRecords).values(insertRecord).returning();
    return record;
  }

  async updateAttendanceRecord(id: number, update: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord> {
    const [record] = await db.update(attendanceRecords).set(update).where(eq(attendanceRecords.id, id)).returning();
    return record;
  }

  // Bulk
  async createEmployeesBulk(insertEmployees: InsertEmployee[]): Promise<Employee[]> {
    if (insertEmployees.length === 0) return [];
    // Handle potential duplicate codes by skipping or updating
    // For simplicity, we filter out existing ones or use onConflictDoNothing
    return await db.insert(employees)
      .values(insertEmployees)
      .onConflictDoNothing({ target: employees.code })
      .returning();
  }

  async createPunchesBulk(insertPunches: InsertBiometricPunch[]): Promise<BiometricPunch[]> {
    if (insertPunches.length === 0) return [];
    return await db.insert(biometricPunches).values(insertPunches).returning();
  }
}

export const storage = new DatabaseStorage();
