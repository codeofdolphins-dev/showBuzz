"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { createStaffByAdminSchema, updateStaffSchema } from "@showbuzz/schemas/staff";
import { createStaffAction, updateStaffAction } from "@/app/_actions/staff";

type CreateInput = z.input<typeof createStaffByAdminSchema>;
type RoleOption = { value: string; label: string; grantable: boolean };

/** Roles the signed-in staff member may give (a role with permissions they lack is listed but disabled). */
function roleOptions(roles: RoleOption[], current?: string) {
  return roles
    .filter((r) => r.grantable || r.value === current)
    .map((r) => ({ value: r.value, label: r.grantable ? r.label : `${r.label} (you can't assign it)` }));
}

/** New staff member: the server generates a temporary password, shown here once. */
export function CreateStaffForm({ roles }: { roles: RoleOption[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; email: string; temporaryPassword: string } | null>(null);
  const form = useForm<CreateInput>({
    resolver: zodResolver(createStaffByAdminSchema),
    defaultValues: { name: "", email: "", roleId: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await createStaffAction(form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Staff member added.");
      setCreated(result.data);
    }),
  );

  if (created) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">
          Account created for {created.email}. Temporary password:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">
            {created.temporaryPassword}
          </code>
          . It is shown only once: share it privately. They should change it from their profile after signing in.
        </FormMessage>
        <div className="flex gap-2">
          <Link
            href={`/users/${created.id}`}
            className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
          >
            Open the account
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCreated(null);
              form.reset();
            }}
          >
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField label="Full name" required error={errors.name?.message} {...form.register("name")} />
      <TextField
        label="Work email"
        type="email"
        required
        hint="Their sign-in for admin.showbuzz.com."
        error={errors.email?.message}
        {...form.register("email")}
      />
      <SelectField
        label="Role"
        required
        placeholder="Choose a role"
        options={roleOptions(roles)}
        error={errors.roleId?.message}
        {...form.register("roleId")}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

type UpdateInput = z.input<typeof updateStaffSchema>;

/** Name and role. Your own role can't be changed here (another Super Admin must do it). */
export function EditStaffForm({
  staffId,
  defaults,
  roles,
  isSelf,
}: {
  staffId: string;
  defaults: UpdateInput;
  roles: RoleOption[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<UpdateInput>({ resolver: zodResolver(updateStaffSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await updateStaffAction(staffId, form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Staff member saved.");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField label="Full name" required error={errors.name?.message} {...form.register("name")} />
      {isSelf ? (
        <TextField
          label="Role"
          readOnly
          value={roles.find((r) => r.value === defaults.roleId)?.label ?? ""}
          hint="You can't change your own role."
        />
      ) : (
        <SelectField
          label="Role"
          required
          options={roleOptions(roles, defaults.roleId)}
          hint="Permission changes apply on their next page load."
          error={errors.roleId?.message}
          {...form.register("roleId")}
        />
      )}
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
