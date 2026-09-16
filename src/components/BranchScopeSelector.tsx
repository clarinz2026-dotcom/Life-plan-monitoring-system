import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBranch, useBranchScope } from "@/hooks/use-branch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Layers } from "lucide-react";

/**
 * Head Office branch selector — `[ ALL BRANCHES ▼ ]`.
 *
 * Renders for CEO / Super Admin only. Choosing a branch points every existing
 * dashboard, list, report, and export at that branch; choosing ALL BRANCHES
 * returns to the company-wide view. Branch staff never see this control, and
 * the server ignores any branch they try to submit, so this is a convenience
 * lens rather than a permission boundary.
 */
export function BranchScopeSelector({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "chrome";
  className?: string;
}) {
  const { isCeoOrAdmin, branchId } = useBranch();
  const { setBranchId } = useBranchScope();

  // One shallow list of branches; skipped entirely for branch staff.
  const branches = useQuery(api.branches.list, isCeoOrAdmin ? {} : "skip");

  if (!isCeoOrAdmin) return null;

  const selected = branches?.find((b) => b._id === branchId) ?? null;
  const activeCount = branches?.filter((b) => b.isActive).length ?? 0;

  const chrome = tone === "chrome";
  const triggerClass = chrome
    ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
    : "border-line bg-paper text-ink hover:border-evergreen/30 hover:shadow-sm";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-all ${triggerClass} ${className}`}
        >
          {selected ? (
            <Building2 className="h-4 w-4 shrink-0 opacity-80" />
          ) : (
            <Layers className="h-4 w-4 shrink-0 opacity-80" />
          )}
          <span className="max-w-[190px] truncate">
            {selected ? selected.name : "ALL BRANCHES"}
          </span>
          {selected && (
            <span
              className={`hidden shrink-0 sm:inline ${
                chrome ? "text-white/50" : "text-stone"
              }`}
            >
              {selected.code}
            </span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone">
          Head Office scope
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => setBranchId(null)}
          className="gap-2.5 py-2.5"
        >
          <Layers className="h-4 w-4 shrink-0 text-stone" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">All Branches</p>
            <p className="text-[11.5px] text-stone">
              Company-wide totals
            </p>
          </div>
          {!branchId && <Check className="h-4 w-4 shrink-0 text-evergreen" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone">
          {activeCount > 0
            ? `${activeCount} active branch${activeCount === 1 ? "" : "es"}`
            : "No branches yet"}
        </DropdownMenuLabel>

        <div className="max-h-[320px] overflow-y-auto">
          {branches?.map((b) => (
            <DropdownMenuItem
              key={b._id}
              onSelect={() => setBranchId(b._id as Id<"branches">)}
              className="gap-2.5 py-2.5"
            >
              <Building2
                className={`h-4 w-4 shrink-0 ${
                  b.isActive ? "text-evergreen" : "text-stone/50"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">
                  {b.name}
                  {!b.isActive && (
                    <span className="ml-1.5 text-[11px] text-stone">
                      (inactive)
                    </span>
                  )}
                </p>
                <p className="truncate text-[11.5px] text-stone">
                  {b.code}
                  {b.city ? ` · ${b.city}` : ""}
                </p>
              </div>
              {branchId === b._id && (
                <Check className="h-4 w-4 shrink-0 text-evergreen" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
