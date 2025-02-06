import * as vscode from 'vscode';
import axios from 'axios';

interface OllamaResponse {
    response: string;
}

export class PromptGenerator {
    private settings: any;
    private disposable: vscode.Disposable;

    constructor(settings: any) {
        this.settings = settings;
        this.disposable = this.registerCommand();
    }

    dispose() {
        this.disposable.dispose();
    }

    private registerCommand() {
        return vscode.commands.registerCommand('ozeki-ai.generateFromPrompt', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter your prompt for code generation',
                placeHolder: 'e.g., Create a function that sorts an array',
                ignoreFocusOut: true
            });

            if (!prompt) return;

            try {
                const code = await this.generateCode(prompt);
                if (code) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const position = editor.selection.active;
                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, '\n' + code);
                        });
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage('Failed to generate code: ' + error);
            }
        });
    }

    private async generateCode(prompt: string): Promise<string> {
        const api = axios.create({
            baseURL: 'http://localhost:11434',
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const requestBody = {
            model: "qwen2.5-coder:1.5b",
            system: "You are a code generation assistant. Generate clean, efficient code based on the prompt.",
            prompt: prompt,
            temperature: 0.1,
            max_tokens: 500,
            stream: false,
            stop: ["#", "//", "```"]
        };

        try {
            const { data } = await api.post('/api/generate', requestBody);
            return (data.response || '')
                .replace(/^```[\w-]*\n?|```$/g, '')  // Remove both opening and closing fences in one pass
                .trim();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('API error:', error.response?.status, error.response?.data);
            }
            throw error;
        }
    }
} 