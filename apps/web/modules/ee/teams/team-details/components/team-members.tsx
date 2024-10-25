"use client";

import { TTeamMember } from "@/modules/ee/teams/team-details/types/teams";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";

interface TeamMembersProps {
  members: TTeamMember[];
  userId: string;
}

export const TeamMembers = ({ members, userId }: TeamMembersProps) => {
  const [teamMembers, setTeamMembers] = useState<TTeamMember[]>(members);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teamMembers.map((teamMember) => (
          <TableRow key={teamMember.id}>
            <TableCell>
              <div className="">
                <div className="font-semibold">{teamMember.name}</div>
                <div className="text-sm text-gray-500">{teamMember.email}</div>
              </div>
            </TableCell>
            <TableCell className="capitalize">{teamMember.role}</TableCell>
            <TableCell>
              <Button variant="warn" size="sm">
                {teamMember.id === userId ? "Leave" : "Remove"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
