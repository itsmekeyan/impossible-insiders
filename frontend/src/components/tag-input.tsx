
"use client";

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input, InputProps } from '@/components/ui/input';

interface TagInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function TagInput({ value, onChange, ...props }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  
  const tags = React.useMemo(() => {
    return value ? value.split(',').filter(tag => tag.trim().length > 0) : [];
  }, [value]);

  const addTag = useCallback((tag: string) => {
    const newTag = tag.trim();
    if (newTag && !tags.includes(newTag)) {
      const newTags = [...tags, newTag];
      onChange(newTags.join(','));
    }
    setInputValue('');
  }, [tags, onChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    onChange(newTags.join(','));
  }, [tags, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '') {
      e.preventDefault();
      if (tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
            {tag}
            <button
              type="button"
              className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        ))}
        <Input
          {...props}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
