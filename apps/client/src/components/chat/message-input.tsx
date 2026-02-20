import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal } from 'lucide-react';

interface MessageInputProps {
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isLoading: boolean;
}

export function MessageInput({
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
}: MessageInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="border-t bg-background p-4 flex items-end gap-2"
        >
            <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[60px] max-h-[200px] resize-none"
                rows={1}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <SendHorizontal className="h-4 w-4" />
            </Button>
        </form>
    );
}
