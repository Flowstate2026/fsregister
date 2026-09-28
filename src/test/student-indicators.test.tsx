import { render, screen } from "@testing-library/react";
import StudentIndicators from "@/components/StudentIndicators";
import type { StudentWithDetails } from "@/hooks/useStudentWithDetails";

const baseStudent = {
  id: "s1",
  first_name: "Test",
  last_name: "Student",
  join_date: "2020-01-01", // old joiner — no NURTURE badge
  notes: [],
} as unknown as StudentWithDetails;

const newStudent = {
  ...baseStudent,
  join_date: new Date().toISOString().slice(0, 10), // joined today
  bulk_imported: false,
} as unknown as StudentWithDetails;

describe("StudentIndicators badges", () => {
  it("shows GREEN badge for 70%+ attendance", () => {
    render(<StudentIndicators student={baseStudent} attendancePercent={85} />);
    expect(screen.getByText("GREEN")).toBeInTheDocument();
    expect(screen.queryByText("85%")).not.toBeInTheDocument();
  });

  it("shows AMBER badge for 50-69% attendance", () => {
    render(<StudentIndicators student={baseStudent} attendancePercent={60} />);
    expect(screen.getByText("AMBER")).toBeInTheDocument();
  });

  it("shows RED badge below 50% attendance", () => {
    render(<StudentIndicators student={baseStudent} attendancePercent={30} />);
    expect(screen.getByText("RED")).toBeInTheDocument();
  });

  it("shows NURTURE badge for new joiners and no star icon", () => {
    render(<StudentIndicators student={newStudent} attendancePercent={90} />);
    expect(screen.getByText("NURTURE")).toBeInTheDocument();
  });

  it("hides NURTURE for bulk-imported students", () => {
    render(
      <StudentIndicators
        student={{ ...newStudent, bulk_imported: true } as StudentWithDetails}
        attendancePercent={90}
      />
    );
    expect(screen.queryByText("NURTURE")).not.toBeInTheDocument();
  });
});
