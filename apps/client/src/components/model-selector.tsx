'use client';

import * as React from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PROVIDERS, type ModelConfig, type ProviderId } from '@/lib/models';

interface ModelSelectorProps {
    model: ModelConfig;
    onModelChange: (model: ModelConfig) => void;
    disabled?: boolean;
}

export function ModelSelector({ model, onModelChange, disabled }: ModelSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            <Select
                value={model.provider}
                onValueChange={(value: string) => {
                    const providerId = value as ProviderId;
                    // Default to first model of the new provider
                    const firstModelId = PROVIDERS[providerId].models[0].id;
                    onModelChange({ provider: providerId, modelId: firstModelId });
                }}
                disabled={disabled}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Provider</SelectLabel>
                        {Object.entries(PROVIDERS).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                                {value.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>

            <Select
                value={model.modelId}
                onValueChange={(value: string) => {
                    onModelChange({ ...model, modelId: value });
                }}
                disabled={disabled}
            >
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                    {PROVIDERS[model.provider].models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                            {m.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
