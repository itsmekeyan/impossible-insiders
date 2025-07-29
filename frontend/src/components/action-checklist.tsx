
"use client";

import React, { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ActionChecklistProps {
  items: string[];
}

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

export function ActionChecklist({ items }: ActionChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    setChecklistItems(
      items.map((item, index) => ({
        id: index,
        text: item,
        completed: false,
      }))
    );
  }, [items]);

  const handleToggle = (id: number) => {
    setChecklistItems(
      checklistItems.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleDelete = (id: number) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {checklistItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
            layout
            className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Checkbox
                id={`item-${item.id}`}
                checked={item.completed}
                onCheckedChange={() => handleToggle(item.id)}
                className="h-5 w-5"
              />
              <label
                htmlFor={`item-${item.id}`}
                className={`flex-1 cursor-pointer text-sm font-medium ${
                  item.completed ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {item.text}
              </label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete item</span>
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
