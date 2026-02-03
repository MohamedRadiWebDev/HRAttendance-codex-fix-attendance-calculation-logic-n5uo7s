import assert from "node:assert/strict";
import {
  computeAdjustmentEffects,
  computeAutomaticNotes,
  computeCheckInOutWithLinks,
  computeOvertimeHours,
  computePenaltyEntries,
  filterLinkedPunches,
} from "./attendance-utils";

const toSeconds = (value: string) => {
  const [h, m, s] = value.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

(() => {
  const result = computeAdjustmentEffects({
    shiftStart: "09:00",
    shiftEnd: "17:00",
    adjustments: [{ type: "اذن صباحي", fromTime: "09:00", toTime: "11:00" }],
  });
  assert.equal(result.effectiveShiftStartSeconds, toSeconds("11:00:00"));
})();

(() => {
  const result = computeAdjustmentEffects({
    shiftStart: "09:00",
    shiftEnd: "17:00",
    adjustments: [{ type: "اذن مسائي", fromTime: "15:00", toTime: "17:00" }],
  });
  assert.equal(result.effectiveShiftEndSeconds, toSeconds("15:00:00"));
})();

(() => {
  const resultStart = computeAdjustmentEffects({
    shiftStart: "09:00",
    shiftEnd: "17:00",
    adjustments: [{ type: "إجازة نص يوم", fromTime: "09:00", toTime: "13:00" }],
  });
  assert.equal(resultStart.effectiveShiftStartSeconds, toSeconds("13:00:00"));
  assert.equal(resultStart.halfDayExcused, true);

  const resultEnd = computeAdjustmentEffects({
    shiftStart: "09:00",
    shiftEnd: "17:00",
    adjustments: [{ type: "إجازة نص يوم", fromTime: "13:00", toTime: "17:00" }],
  });
  assert.equal(resultEnd.effectiveShiftEndSeconds, toSeconds("13:00:00"));
  assert.equal(resultEnd.halfDayExcused, true);
})();

(() => {
  const result = computeAdjustmentEffects({
    shiftStart: "09:00",
    shiftEnd: "17:00",
    adjustments: [{ type: "مأمورية", fromTime: "09:00", toTime: "17:00" }],
    checkInSeconds: toSeconds("10:00:00"),
    checkOutSeconds: toSeconds("16:00:00"),
  });
  assert.equal(result.firstStampSeconds, toSeconds("09:00:00"));
  assert.equal(result.lastStampSeconds, toSeconds("17:00:00"));
  assert.equal(result.suppressPenalties, true);
})();

(() => {
  const notes = computeAutomaticNotes({
    existingNotes: "",
    checkInExists: true,
    checkOutExists: false,
    missingStampExcused: false,
    earlyLeaveExcused: false,
    checkOutBeforeEarlyLeave: false,
  });
  assert.ok(notes.includes("سهو بصمة"));
})();

(() => {
  const notes = computeAutomaticNotes({
    existingNotes: "",
    checkInExists: false,
    checkOutExists: true,
    missingStampExcused: false,
    earlyLeaveExcused: false,
    checkOutBeforeEarlyLeave: false,
  });
  assert.ok(notes.includes("سهو بصمة دخول"));
})();

(() => {
  const notes = computeAutomaticNotes({
    existingNotes: "",
    checkInExists: true,
    checkOutExists: true,
    missingStampExcused: false,
    earlyLeaveExcused: false,
    checkOutBeforeEarlyLeave: true,
  });
  assert.ok(notes.includes("انصراف مبكر"));
})();

(() => {
  const penalties = computePenaltyEntries({
    isExcused: false,
    latePenaltyValue: 0.25,
    lateMinutes: 10,
    missingCheckout: true,
    earlyLeaveTriggered: false,
  });
  const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.value, 0);
  assert.equal(totalPenalty, 0.75);
})();

(() => {
  const penalties = computePenaltyEntries({
    isExcused: false,
    latePenaltyValue: 0,
    lateMinutes: 0,
    missingCheckout: false,
    earlyLeaveTriggered: true,
  });
  assert.deepEqual(penalties, [{ type: "انصراف مبكر", value: 0.5 }]);
})();

(() => {
  const penalties = computePenaltyEntries({
    isExcused: false,
    latePenaltyValue: 0,
    lateMinutes: 0,
    missingCheckout: true,
    earlyLeaveTriggered: true,
  });
  assert.deepEqual(penalties, [{ type: "سهو بصمة", value: 0.5 }]);
})();

(() => {
  const penalties = computePenaltyEntries({
    isExcused: true,
    latePenaltyValue: 0.25,
    lateMinutes: 20,
    missingCheckout: true,
    earlyLeaveTriggered: true,
  });
  assert.deepEqual(penalties, []);
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 17 * 3600 + 59 * 60 }),
    0
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 18 * 3600 }),
    0
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 18 * 3600 + 59 * 60 }),
    0
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 19 * 3600 }),
    1
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 19 * 3600 + 5 * 60 }),
    1
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 20 * 3600 + 10 * 60 }),
    2
  );
})();

(() => {
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds: 19 * 3600 }),
    1
  );
})();

(() => {
  const checkOutSeconds = 24 * 3600 + 2 * 3600 + 30 * 60;
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds }),
    8
  );
})();

(() => {
  const checkOutSeconds = 24 * 3600 + 8 * 3600;
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds }),
    14
  );
})();

(() => {
  const checkOutSeconds = 24 * 3600 + 12 * 3600;
  assert.equal(
    computeOvertimeHours({ shiftEnd: "17:00", checkOutSeconds }),
    15
  );
})();

(() => {
  const day24Punches = [new Date("2025-01-24T09:22:00Z")];
  const linkedPunches = [new Date("2025-01-25T00:40:00Z")];
  const resultDay24 = computeCheckInOutWithLinks({ dayPunches: day24Punches, linkedPunches });
  assert.equal(resultDay24.checkOut?.toISOString(), "2025-01-25T00:40:00.000Z");

  const day25Punches = [{ employeeCode: "E1", punchDatetime: new Date("2025-01-25T00:40:00Z") }];
  const filteredDay25 = filterLinkedPunches({
    dayPunches: day25Punches,
    linkedKeys: new Set(["E1__2025-01-25T00:40:00.000Z"]),
    employeeCode: "E1",
  });
  const resultDay25 = computeCheckInOutWithLinks({
    dayPunches: filteredDay25.map(p => p.punchDatetime),
    linkedPunches: [],
  });
  assert.equal(resultDay25.checkIn, null);
  assert.equal(resultDay25.checkOut, null);
})();

(() => {
  const linkDay28 = new Date("2025-01-29T07:00:00Z");
  const linkDay29 = new Date("2025-01-30T08:00:00Z");
  const linkDay30 = new Date("2025-01-31T08:00:00Z");
  const resultDay28 = computeCheckInOutWithLinks({ dayPunches: [new Date("2025-01-28T09:00:00Z")], linkedPunches: [linkDay28] });
  const resultDay29 = computeCheckInOutWithLinks({ dayPunches: [new Date("2025-01-29T09:00:00Z")], linkedPunches: [linkDay29] });
  const resultDay30 = computeCheckInOutWithLinks({ dayPunches: [new Date("2025-01-30T09:00:00Z")], linkedPunches: [linkDay30] });
  assert.equal(resultDay28.checkOut?.toISOString(), "2025-01-29T07:00:00.000Z");
  assert.equal(resultDay29.checkOut?.toISOString(), "2025-01-30T08:00:00.000Z");
  assert.equal(resultDay30.checkOut?.toISOString(), "2025-01-31T08:00:00.000Z");
})();

console.log("attendance-utils tests passed");
