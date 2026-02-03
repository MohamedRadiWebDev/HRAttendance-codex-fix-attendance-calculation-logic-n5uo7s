import { useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/use-employees";
import { useFingerprintExceptionAction, useFingerprintExceptions } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";

const SUSPICION_TYPES = ["خروج بعد 12", "مبيت محتمل", "بصمة غير طبيعية"];

export default function FingerprintExceptions() {
  const { data: employees } = useEmployees();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    employeeCode: "",
    sector: "all",
    department: "all",
    type: "all",
  });

  const sectors = useMemo(
    () => Array.from(new Set(employees?.map(emp => emp.sector).filter(Boolean) || [])),
    [employees]
  );

  const departments = useMemo(
    () => Array.from(new Set(employees?.map(emp => emp.department).filter(Boolean) || [])),
    [employees]
  );

  const effectiveFilters = {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    employeeCode: filters.employeeCode || undefined,
    sector: filters.sector !== "all" ? filters.sector : undefined,
    department: filters.department !== "all" ? filters.department : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
  };

  const { data: exceptions, isLoading } = useFingerprintExceptions(effectiveFilters);
  const exceptionAction = useFingerprintExceptionAction();

  const handleAction = (item: any, action: "carryback" | "overnight" | "ignore") => {
    exceptionAction.mutate({
      exceptionKey: item.exceptionKey,
      action,
      employeeCode: item.employeeCode,
      type: item.type,
      baseDate: item.baseDate,
      startDate: item.startDate,
      endDate: item.endDate,
      punchDetails: item.punchDetails,
    }, {
      onSuccess: () => {
        toast({ title: "تم الحفظ", description: "تم تسجيل القرار بنجاح." });
      },
      onError: (error: any) => {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="مراجعة البصمات بعد منتصف الليل / المبيت" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-6">
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters(prev => ({ ...prev, startDate: event.target.value }))}
                />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters(prev => ({ ...prev, endDate: event.target.value }))}
                />
                <Input
                  placeholder="كود الموظف"
                  value={filters.employeeCode}
                  onChange={(event) => setFilters(prev => ({ ...prev, employeeCode: event.target.value }))}
                />
                <Select value={filters.sector} onValueChange={(value) => setFilters(prev => ({ ...prev, sector: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="القطاع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل القطاعات</SelectItem>
                    {sectors.map(sector => (
                      <SelectItem key={sector} value={sector as string}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="الإدارة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الإدارات</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept as string}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="نوع الاشتباه" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {SUSPICION_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-600">الكود</th>
                    <th className="px-4 py-3 font-bold text-slate-600">الاسم</th>
                    <th className="px-4 py-3 font-bold text-slate-600">التاريخ</th>
                    <th className="px-4 py-3 font-bold text-slate-600">نوع الاشتباه</th>
                    <th className="px-4 py-3 font-bold text-slate-600">تفاصيل البصمة</th>
                    <th className="px-4 py-3 font-bold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">جاري التحميل...</td>
                    </tr>
                  ) : exceptions?.length ? (
                    exceptions.map((item) => (
                      <tr key={item.exceptionKey} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono">{item.employeeCode}</td>
                        <td className="px-4 py-3">{item.employeeName || "-"}</td>
                        <td className="px-4 py-3">
                          {item.baseDate || `${item.startDate || ""} ${item.endDate ? `→ ${item.endDate}` : ""}`}
                        </td>
                        <td className="px-4 py-3">{item.type}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.punchDetails ? JSON.stringify(item.punchDetails) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(item, "carryback")}
                              disabled={exceptionAction.isPending}
                            >
                              اعتبار خروج بعد 12
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(item, "overnight")}
                              disabled={exceptionAction.isPending}
                            >
                              اعتبار مبيت
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(item, "ignore")}
                              disabled={exceptionAction.isPending}
                            >
                              تجاهل
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">لا توجد استثناءات حالياً.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
