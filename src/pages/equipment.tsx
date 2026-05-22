import { ClipboardCheck, ShieldAlert, Wrench } from "lucide-react";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const equipment = [
  { name: "Drill press", status: "Safety test required", icon: ShieldAlert },
  { name: "Bandsaw", status: "Instructor approval", icon: ClipboardCheck },
  { name: "Soldering iron", status: "Training unit", icon: Wrench },
  { name: "CNC router", status: "Advanced sign-off", icon: ClipboardCheck },
];

export function EquipmentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Equipment"
        title="Equipment sign-offs"
        description="Placeholder workflow for tool readiness, safety tests, mentor approvals, and shop access records."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {equipment.map((item) => (
          <Card key={item.name}>
            <CardHeader>
              <item.icon className="size-5 text-primary" />
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>{item.status}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Planned Convex record</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Approval workflow planned</CardTitle>
          <CardDescription>
            Students will request sign-offs after completing required lessons and
            tests. Instructors will approve, reject, or request more practice.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
