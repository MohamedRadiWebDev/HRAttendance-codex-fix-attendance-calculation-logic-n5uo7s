import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertEmployeeSchema, insertTemplateSchema, insertRuleSchema, insertAdjustmentSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Employees
  app.get(api.employees.list.path, async (req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post(api.employees.create.path, async (req, res) => {
    try {
      const input = api.employees.create.input.parse(req.body);
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.employees.get.path, async (req, res) => {
    const employee = await storage.getEmployee(Number(req.params.id));
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  });

  app.put(api.employees.update.path, async (req, res) => {
    try {
      const input = api.employees.update.input.parse(req.body);
      const employee = await storage.updateEmployee(Number(req.params.id), input);
      res.json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Templates
  app.get(api.templates.list.path, async (req, res) => {
    const templates = await storage.getTemplates();
    res.json(templates);
  });

  app.post(api.templates.create.path, async (req, res) => {
    try {
      const input = api.templates.create.input.parse(req.body);
      const template = await storage.createTemplate(input);
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      throw err;
    }
  });

  app.delete(api.templates.delete.path, async (req, res) => {
    await storage.deleteTemplate(Number(req.params.id));
    res.status(204).end();
  });

  // Rules
  app.get(api.rules.list.path, async (req, res) => {
    const rules = await storage.getRules();
    res.json(rules);
  });

  app.post(api.rules.create.path, async (req, res) => {
    try {
      const input = api.rules.create.input.parse(req.body);
      const rule = await storage.createRule(input);
      res.status(201).json(rule);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.rules.delete.path, async (req, res) => {
    await storage.deleteRule(Number(req.params.id));
    res.status(204).end();
  });

  // Adjustments
  app.get(api.adjustments.list.path, async (req, res) => {
    const adjustments = await storage.getAdjustments();
    res.json(adjustments);
  });

  app.post(api.adjustments.create.path, async (req, res) => {
    try {
      const input = api.adjustments.create.input.parse(req.body);
      const adj = await storage.createAdjustment(input);
      res.status(201).json(adj);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Attendance
  app.get(api.attendance.list.path, async (req, res) => {
    const { startDate, endDate, employeeCode, page = 1, limit = 50 } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start and End dates required" });
    }
    const limitNumber = Number(limit);
    const safeLimit = Number.isFinite(limitNumber) && limitNumber > 0 ? limitNumber : 0;
    const pageNumber = Number(page);
    const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const offset = safeLimit > 0 ? (safePage - 1) * safeLimit : 0;
    const { data, total } = await storage.getAttendance(
      String(startDate), 
      String(endDate), 
      employeeCode as string,
      safeLimit,
      offset
    );
    res.json({ data, total, page: safePage, limit: safeLimit });
  });

  app.post(api.attendance.process.path, async (req, res) => {
    const { startDate, endDate } = req.body;
    try {
      const safeOffsetMinutes = Number.isFinite(Number(timezoneOffsetMinutes))
        ? Number(timezoneOffsetMinutes)
        : 0;
      // Format date in local timezone space using the provided offset
      const formatDateLocal = (date: Date) => {
        const localTime = new Date(date.getTime() - safeOffsetMinutes * 60 * 1000);
        const year = localTime.getUTCFullYear();
        const month = String(localTime.getUTCMonth() + 1).padStart(2, "0");
        const day = String(localTime.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const allEmployees = await storage.getEmployees();
      
      // Compute punch fetch bounds in UTC using local day boundaries
      const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
      const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
      const punchStart = new Date(
        Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) + safeOffsetMinutes * 60 * 1000
      );
      
      const punchEnd = new Date(
        Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) + safeOffsetMinutes * 60 * 1000
      );
      
      const punches = await storage.getPunches(punchStart, punchEnd);
      const rules = await storage.getRules();
      const adjustments = await storage.getAdjustments();
      
      let processedCount = 0;
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (const employee of allEmployees) {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDate(d);
          
          // 1. Get applicable rules for this employee and date
          const activeRules = rules.filter(r => {
            const ruleStart = new Date(r.startDate);
            const ruleEnd = new Date(r.endDate);
            const current = new Date(dateStr);
            if (current < ruleStart || current > ruleEnd) return false;
            
            if (r.scope === 'all') return true;
            if (r.scope.startsWith('dept:') && employee.department === r.scope.replace('dept:', '')) return true;
            if (r.scope.startsWith('sector:') && employee.sector === r.scope.replace('sector:', '')) return true;
            if (r.scope.startsWith('emp:') && employee.code === r.scope.replace('emp:', '')) return true;
            return false;
          }).sort((a, b) => (b.priority || 0) - (a.priority || 0));

          // 2. Determine shift times based on rules or employee default
          let currentShiftStart = employee.shiftStart || "09:00";
          let currentShiftEnd = "17:00"; // Default 8 hours
          
          const shiftRule = activeRules.find(r => r.ruleType === 'custom_shift');
          if (shiftRule) {
            currentShiftStart = (shiftRule.params as any).shiftStart || currentShiftStart;
            currentShiftEnd = (shiftRule.params as any).shiftEnd || currentShiftEnd;
          }

          // 3. Check for leaves/adjustments
          const activeAdj = adjustments.find(a => 
            a.employeeCode === employee.code && 
            dateStr >= a.startDate && 
            dateStr <= a.endDate
          );

          const dayPunches = punches.filter(p => 
            p.employeeCode === employee.code && 
            formatDateLocal(p.punchDatetime) === dateStr
          ).sort((a, b) => a.punchDatetime.getTime() - b.punchDatetime.getTime());

          if (dayPunches.length > 0 || activeAdj) {
            const checkIn = dayPunches.length > 0 ? dayPunches[0].punchDatetime : null;
            const checkOut = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1].punchDatetime : null;
            
            let totalHours = 0;
            if (checkIn && checkOut) {
              totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            }

            let penalties = [];
            let status = activeAdj ? "Excused" : "Present";
            const shiftStartParts = currentShiftStart.split(':');
            const shiftStartHour = parseInt(shiftStartParts[0]);
            const shiftStartMin = parseInt(shiftStartParts[1]);
            // Local shift time for this date
            const shiftStartUTC = new Date(Date.UTC(
              d.getUTCFullYear(),
              d.getUTCMonth(),
              d.getUTCDate(),
              shiftStartHour,
              shiftStartMin,
              0
            ));
            // Adjust to UTC based on client timezone
            shiftStartUTC.setTime(shiftStartUTC.getTime() + safeOffsetMinutes * 60 * 1000);

            if (!activeAdj && checkIn) {
              const diffMs = checkIn.getTime() - shiftStart.getTime();
              const lateMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
              if (diffMs > 15 * 60 * 1000) {
                status = "Late";
                let latePenalty = 0;
                if (lateMinutes > 60) latePenalty = 1;
                else if (lateMinutes > 30) latePenalty = 0.5;
                else latePenalty = 0.25;
                
                penalties.push({ type: "تأخير", value: latePenalty, minutes: lateMinutes });
              } else {
                status = "Present";
              }
            } else if (!activeAdj && !checkIn) {
              status = "Absent";
              penalties.push({ type: "غياب", value: 1 });
            }

            await storage.createAttendanceRecord({
              employeeCode: employee.code,
              date: dateStr,
              checkIn,
              checkOut,
              totalHours,
              status,
              overtimeHours: Math.max(0, totalHours - 8),
              penalties,
              isOvernight: activeRules.some(r => r.ruleType === 'overtime_overnight')
            });
            processedCount++;
          } else {
            // Absent
             await storage.createAttendanceRecord({
              employeeCode: employee.code,
              date: dateStr,
              checkIn: null,
              checkOut: null,
              totalHours: 0,
              status: "Absent",
              overtimeHours: 0,
              penalties: [],
              isOvernight: false
            });
            processedCount++;
          }
        }
      }

      res.json({ message: "Processing completed", processedCount });
    } catch (err: any) {
      console.error("Processing Error:", err);
      res.status(500).json({ message: "Failed to process attendance", error: err.message });
    }
  });

  // Import
  app.post(api.import.punches.path, async (req, res) => {
    try {
      const punches = z.array(z.object({
        employeeCode: z.string(),
        punchDatetime: z.string().transform(val => new Date(val)),
      })).parse(req.body);
      const result = await storage.createPunchesBulk(punches);
      res.json({ message: "Imported punches", count: result.length });
    } catch (err) {
      console.error("Import Punches Error:", err);
      res.status(400).json({ message: "Invalid punch data format" });
    }
  });

  app.post(api.import.employees.path, async (req, res) => {
    const employees = req.body;
    const result = await storage.createEmployeesBulk(employees);
    res.json({ message: "Imported employees", count: result.length });
  });

  // Seeding
  const employeesCount = await storage.getEmployees();
  if (employeesCount.length === 0) {
    console.log("Database is empty. Ready for import.");
  }

  // Wiping Data
  app.post("/api/admin/wipe-data", async (req, res) => {
    try {
      await storage.wipeAllData();
      res.json({ message: "تم مسح كافة البيانات بنجاح" });
    } catch (err: any) {
      res.status(500).json({ message: "فشل مسح البيانات", error: err.message });
    }
  });

  return httpServer;
}
