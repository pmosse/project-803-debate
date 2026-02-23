"use client";

import { Control, useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2 } from "lucide-react";

interface RubricBuilderProps {
  control: Control<any>;
  register: any;
  errors: any;
}

export function RubricBuilder({ control, register, errors }: RubricBuilderProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "rubricCriteria",
  });

  const criteria = useWatch({ control, name: "rubricCriteria" }) || [];
  const total = criteria.reduce(
    (sum: number, c: any) => sum + (Number(c?.maxPoints) || 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Rubric Criteria</Label>
          <p className="text-xs text-gray-500">
            Total: {total} pts{total > 100 && <span className="text-red-500 ml-1">(max 100)</span>}
          </p>
        </div>
        {fields.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: "", description: "", maxPoints: 10 })}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Criterion
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-400">
          No criteria added. Add criteria for structured scoring, or leave empty to use free-text rubric.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2"
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                {...register(`rubricCriteria.${index}.name`)}
                placeholder="Criterion name (e.g., Evidence Use)"
                className="bg-white"
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                min={1}
                max={10}
                {...register(`rubricCriteria.${index}.maxPoints`, {
                  valueAsNumber: true,
                })}
                placeholder="Pts"
                className="bg-white"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          <textarea
            {...register(`rubricCriteria.${index}.description`)}
            placeholder="Describe what this criterion measures..."
            rows={2}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B9D9EB] focus:border-[#1D4F91]"
          />
          {errors?.rubricCriteria?.[index]?.maxPoints && (
            <p className="text-xs text-red-600">
              {errors.rubricCriteria[index].maxPoints.message}
            </p>
          )}
        </div>
      ))}

      {errors?.rubricCriteria?.root && (
        <p className="text-sm text-red-600">
          {errors.rubricCriteria.root.message}
        </p>
      )}
    </div>
  );
}
