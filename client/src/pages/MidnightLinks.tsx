import { useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/use-employees";
import { useImportMidnightLinks, useMidnightLinkAction, useMidnightPunches } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const ACTIONS = [
  { value: "previous_day_checkout", label: "اربطها كخروج لليوم السابق" },
  { value: "current_day_checkin", label: "اتركها كدخول لليوم الحالي" },
  { value: "ignore", label: "تجاهل" },
];

export default function MidnightLinks() {
  const { data: employees } = useEmployees();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    employeeCode: "",
    sector: "all",
    branch: "all",
  });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const midnightLinkAction = useMidnightLinkAction();
  const importLinks = useImportMidnightLinks();

  const sectors = useMemo(
    () => Array.from(new Set(employees?.map(emp => emp.sector).filter(Boolean) || [])),
    [employees]
  );
  const branches = useMemo(
    () => Array.from(new Set(employees?.map(emp => emp.branch).filter(Boolean) || [])),
    [employees]
  );

  const { data: punches, isLoading } = useMidnightPunches({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    employeeCode: filters.employeeCode || undefined,
    sector: filters.sector !== "all" ? filters.sector : undefined,
    branch: filters.branch !== "all" ? filters.branch : undefined,
  });

  const handleAction = (item: any, action: string) => {
    const note = noteDrafts[item.punchDateTime];
    midnightLinkAction.mutate({
      employeeCode: item.employeeCode,
      punchDateTime: item.punchDateTime,
      action: action as any,
      targetBaseDate: action === "previous_day_checkout" ? item.suggestedPreviousDate : null,
      note: note || null,
    }, {
      onSuccess: () => toast({ title: "تم الحفظ", description: "تم تحديث الربط بنجاح." }),
      onError: (error: any) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
    });
  };

  const exportLinks = () => {
    if (!punches || punches.length === 0) return;
    const rows = punches.map((item: any) => ({
      "الكود": item.employeeCode,
      "الاسم": item.employeeName || "",
      "تاريخ_البصمة": item.punchDate,
      "وقت_البصمة": item.punchTime,
      "اربط_كخروج_لليوم_السابق (1/0)": item.status === "previous_day_checkout" ? 1 : 0,
      "التاريخ_الاساسي": item.targetBaseDate || item.suggestedPreviousDate,
      "ملاحظة": item.note || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "links");
    XLSX.writeFile(workbook, "midnight_links.xlsx");
  };

  const importFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const headerRow = rows[0] || [];
    const headers = headerRow.map((cell) => String(cell).trim());
    const expected = ["الكود", "الاسم", "تاريخ_البصمة", "وقت_البصمة", "اربط_كخروج_لليوم_السابق (1/0)", "التاريخ_الاساسي", "ملاحظة"];
    const valid = expected.every((header, index) => headers[index] === header);
    if (!valid) {
      toast({ title: "خطأ", description: "عناوين الملف غير مطابقة.", variant: "destructive" });
      return;
    }

    const payloadRows = rows.slice(1).map((row) => ({
      employeeCode: String(row[0] ?? "").trim(),
      punchDate: String(row[2] ?? "").trim(),
      punchTime: String(row[3] ?? "").trim(),
      linkToPreviousDay: Number(row[4] ?? 0),
      baseDate: String(row[5] ?? "").trim(),
      note: String(row[6] ?? "").trim() || null,
    }));

    importLinks.mutate({ rows: payloadRows }, {
      onSuccess: (data) => {
        toast({ title: "تم الاستيراد", description: `تم حفظ ${data.inserted} سجل.` });
        if (data.invalid.length > 0) {
          toast({ title: "تحقق", description: `يوجد ${data.invalid.length} صفوف غير صالحة.`, variant: "destructive" });
        }
      },
      onError: (error: any) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
    });
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="ربط بصمة بعد منتصف الليل" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-6">
                <Input type="date" value={filters.startDate} onChange={(event) => setFilters(prev => ({ ...prev, startDate: event.target.value }))} />
                <Input type="date" value={filters.endDate} onChange={(event) => setFilters(prev => ({ ...prev, endDate: event.target.value }))} />
                <Input placeholder="كود الموظف" value={filters.employeeCode} onChange={(event) => setFilters(prev => ({ ...prev, employeeCode: event.target.value }))} />
                <Select value={filters.sector} onValueChange={(value) => setFilters(prev => ({ ...prev, sector: value }))}>
                  <SelectTrigger><SelectValue placeholder="القطاع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل القطاعات</SelectItem>
                    {sectors.map(sector => (
                      <SelectItem key={sector} value={sector as string}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.branch} onValueChange={(value) => setFilters(prev => ({ ...prev, branch: value }))}>
                  <SelectTrigger><SelectValue placeholder="الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch} value={branch as string}>{branch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="file" accept=".xlsx" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importFile(file);
                  }} />
                  <Button variant="outline" onClick={exportLinks}>تصدير</Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3">الكود</th>
                    <th className="px-4 py-3">الاسم</th>
                    <th className="px-4 py-3">تاريخ البصمة</th>
                    <th className="px-4 py-3">وقت البصمة</th>
                    <th className="px-4 py-3">البصمة كاملة</th>
                    <th className="px-4 py-3">التاريخ المقترح</th>
                    <th className="px-4 py-3">الإجراء</th>
                    <th className="px-4 py-3">ملاحظة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                  ) : punches?.length ? (
                    punches.map((item: any) => (
                      <tr key={item.punchDateTime}>
                        <td className="px-4 py-3 font-mono">{item.employeeCode}</td>
                        <td className="px-4 py-3">{item.employeeName || "-"}</td>
                        <td className="px-4 py-3">{item.punchDate}</td>
                        <td className="px-4 py-3">{item.punchTime}</td>
                        <td className="px-4 py-3 text-xs">{item.punchDateTime}</td>
                        <td className="px-4 py-3">{item.suggestedPreviousDate}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {ACTIONS.map((action) => (
                              <Button
                                key={action.value}
                                size="sm"
                                variant={item.status === action.value ? "default" : "outline"}
                                onClick={() => handleAction(item, action.value)}
                                disabled={midnightLinkAction.isPending}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={noteDrafts[item.punchDateTime] ?? item.note ?? ""}
                            onChange={(event) => setNoteDrafts(prev => ({ ...prev, [item.punchDateTime]: event.target.value }))}
                            placeholder="ملاحظة"
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">لا توجد بصمات.</td></tr>
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
