"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { TextAreaField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { EXTRA_PERMISSION_LABELS, PERMISSION_GROUPS } from "@showbuzz/schemas/permissions";
import { roleSchema } from "@showbuzz/schemas/staff";
import { cn } from "@showbuzz/utils/cn";
import { createRoleAction, updateRoleAction } from "@/app/_actions/staff";

type Input = z.input<typeof roleSchema>;
type Output = z.output<typeof roleSchema>;

interface RoleFormProps {
  roleId?: string;
  defaults?: Input;
  /** System roles keep their name. */
  nameLocked?: boolean;
  /** Super Admin: shown, not editable. */
  readOnly?: boolean;
  /** The editor's own permissions: anything else can't be granted (shown disabled). */
  grantable: string[];
}

function Check({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 rounded border-admin-border accent-admin-indigo", disabled && "opacity-40")}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

/**
 * Prototype roles.html: the permission matrix (module × view / manage) plus the extra actions. "Manage" includes
 * "view". Permissions you don't hold yourself are disabled (no self-promotion; the server checks it too).
 */
export function RoleForm({ roleId, defaults, nameLocked = false, readOnly = false, grantable }: RoleFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(roleSchema),
    defaultValues: defaults ?? { name: "", description: "", permissions: [] },
  });
  const errors = form.formState.errors;
  const can = (permission: string) => !readOnly && grantable.includes(permission);

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = roleId ? await updateRoleAction(roleId, values) : await createRoleAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(roleId ? "Role saved. Staff with it get the new permissions on their next page." : "Role created.");
      router.push("/roles");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Role name"
          required
          readOnly={readOnly || nameLocked}
          hint={nameLocked ? "System roles keep their name." : undefined}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <TextAreaField
          label="Description"
          rows={2}
          readOnly={readOnly}
          error={errors.description?.message}
          {...form.register("description")}
        />
      </div>
      <Controller
        control={form.control}
        name="permissions"
        render={({ field }) => {
          const has = (p: string) => field.value.includes(p);
          const set = (add: string[], remove: string[]) =>
            field.onChange([...new Set([...field.value.filter((p) => !remove.includes(p)), ...add])]);
          return (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-admin-border">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Permission matrix</caption>
                  <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-bold">
                        Module
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-center font-bold">
                        View
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-center font-bold">
                        Manage
                      </th>
                    </tr>
                  </thead>
                  {PERMISSION_GROUPS.map((group) => (
                    <tbody key={group.label} className="divide-y divide-slate-100">
                      <tr className="bg-admin-active/40">
                        <th colSpan={3} scope="colgroup" className="px-4 py-1.5 text-[11px] font-bold text-admin-indigo">
                          {group.label}
                        </th>
                      </tr>
                      {group.resources.map((resource) => {
                        const read = `${resource.id}:read`;
                        const write = `${resource.id}:write`;
                        return (
                          <tr key={resource.id}>
                            <th scope="row" className="px-4 py-2 font-semibold text-admin-text">
                              {resource.label}
                            </th>
                            <td className="px-4 py-2 text-center">
                              <Check
                                label={`View ${resource.label}`}
                                checked={has(read)}
                                disabled={!can(read) || has(write)}
                                onChange={(on) => (on ? set([read], []) : set([], [read]))}
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Check
                                label={`Manage ${resource.label}`}
                                checked={has(write)}
                                disabled={!can(write) || !can(read)}
                                onChange={(on) => (on ? set([read, write], []) : set([], [write]))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-[13px] font-semibold text-admin-text">Extra actions</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EXTRA_PERMISSION_LABELS.map((extra) => (
                    <label key={extra.id} className="flex items-center gap-2 text-xs text-admin-text">
                      <Check
                        label={extra.label}
                        checked={has(extra.id)}
                        disabled={!can(extra.id)}
                        onChange={(on) => (on ? set([extra.id], []) : set([], [extra.id]))}
                      />
                      {extra.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {errors.permissions ? (
                <p className="text-[11px] font-medium text-admin-danger">
                  {errors.permissions.message ?? "Check the permissions"}
                </p>
              ) : null}
            </div>
          );
        }}
      />
      {readOnly ? null : (
        <div className="flex justify-end border-t border-admin-border pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : roleId ? "Save permissions" : "Create role"}
          </Button>
        </div>
      )}
    </form>
  );
}
