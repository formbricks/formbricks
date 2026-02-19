"use client";

import { ReactNode } from "react";

interface EditableDashboardHeaderProps {
  name: string;
  description: string;
  isEditing: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  children?: ReactNode;
}

export function EditableDashboardHeader({
  name,
  description,
  isEditing,
  onNameChange,
  onDescriptionChange,
  children,
}: EditableDashboardHeaderProps) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between space-x-4 pb-4">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 text-3xl font-bold text-slate-800 focus:border-brand-dark focus:outline-none focus:ring-0"
            placeholder="Dashboard name"
          />
        ) : (
          <h1 className="border border-transparent px-2 py-1 text-3xl font-bold text-slate-800">{name}</h1>
        )}
        {children}
      </div>

      {isEditing ? (
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="mb-3 mt-1 w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 text-sm text-slate-500 placeholder:text-slate-400 focus:border-brand-dark focus:outline-none focus:ring-0"
          placeholder="Add a description..."
        />
      ) : description ? (
        <p className="mb-3 mt-1 border border-transparent px-2 py-1 text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
