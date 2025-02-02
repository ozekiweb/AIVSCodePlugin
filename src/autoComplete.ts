import * as vscode from 'vscode';
import axios from 'axios';

interface OllamaResponse {
    response: string;
}

export class AutoCompleteProvider {
    private settings: any;
    private timeout: NodeJS.Timeout | undefined;
    private lastPosition: vscode.Position | undefined;
    private disposables: vscode.Disposable[] = [];
    private decorationType: vscode.TextEditorDecorationType;
    private lastSuggestion: string = '';
    private enabled: boolean = true;
    private statusBarItem: vscode.StatusBarItem;
    private isAccepting: boolean = false;

    constructor(settings: any) {
        this.settings = settings;
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            'autoCompleteStatus',
            vscode.StatusBarAlignment.Right
        );
        this.updateStatusBar();
        this.statusBarItem.show();
        
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'gray',
                fontStyle: 'italic'
            }
        });

        // Register commands
        this.disposables.push(
            vscode.commands.registerCommand('ozeki-ai.toggleAutoComplete', () => {
                this.enabled = !this.enabled;
                this.updateStatusBar();
                vscode.window.showInformationMessage(
                    `AI Code Completion: ${this.enabled ? 'Enabled' : 'Disabled'}`
                );
            })
        );

        // Register the accept suggestion command
        this.disposables.push(
            vscode.commands.registerCommand('ozeki-ai.acceptSuggestion', () => {
                this.acceptSuggestion();
            })
        );

        // Watch for editor changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onDocumentChange.bind(this))
        );
    }

    private updateStatusBar() {
        this.statusBarItem.text = `$(lightbulb) AI Complete: ${this.enabled ? 'On' : 'Off'}`;
        this.statusBarItem.tooltip = 'Click to toggle AI Code Completion';
        this.statusBarItem.command = 'ozeki-ai.toggleAutoComplete';
    }

    private async onDocumentChange(event: vscode.TextDocumentChangeEvent) {
        if (!this.enabled) return;
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Clear existing timeout and decoration
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        editor.setDecorations(this.decorationType, []);

        // Store current position
        this.lastPosition = editor.selection.active;

        this.timeout = setTimeout(async () => {
            await this.provideSuggestion(editor);
        }, 1000);
    }

    private async provideSuggestion(editor: vscode.TextEditor) {
        if (!this.lastPosition) return;

        try {
            const suggestion = await this.getCodeSuggestion('');
            if (suggestion && suggestion.trim()) {
                this.lastSuggestion = suggestion;

                // Show notification as ghost text
                editor.setDecorations(this.decorationType, [{
                    range: new vscode.Range(
                        editor.selection.active,
                        editor.selection.active
                    ),
                    renderOptions: {
                        after: {
                            contentText: "Suggestion is ready, press CTRL + SPACE to apply",
                            color: { id: 'editorGhostText.foreground' },
                            fontStyle: 'italic'
                        }
                    }
                }]);
            }
        } catch (error) {
            console.error('Failed to get code suggestion:', error);
        }
    }

    private async acceptSuggestion() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.lastPosition || this.isAccepting) return;

        try {
            this.isAccepting = true;
            const currentPos = editor.selection.active;
            const ghostText = this.lastSuggestion;

            if (ghostText) {
                await editor.edit(editBuilder => {
                    // Insert newline first, then the suggestion
                    editBuilder.insert(currentPos, '\n' + ghostText);
                });
                this.lastSuggestion = '';
            }
            editor.setDecorations(this.decorationType, []);
        } finally {
            this.isAccepting = false;
        }
    }

    private async getCodeSuggestion(context: string): Promise<string> {
        if (!this.settings) {
            throw new Error('Settings not configured');
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.lastPosition) return '';

        const document = editor.document;
        const prefix_code = document.getText(new vscode.Range(
            new vscode.Position(0, 0),
            this.lastPosition
        ));
        const suffix_code = document.getText(new vscode.Range(
            this.lastPosition,
            document.lineAt(document.lineCount - 1).range.end
        ));

        const requestBody = {
            model: "qwen2.5-coder:1.5b",
            system: "You are Qwen, an autocompletion assistant, when you receive an incomplete code you try to predict the missing code, using the the incomplete code. You are a professional so you don't waste time explaining.",
            prompt: `${prefix_code}${suffix_code}`,
            temperature: 0.1,
            max_tokens:30,
            stream: false,
            stop: ["#", "//","```"]
        };

        console.log('Sending request with body:', JSON.stringify(requestBody, null, 2));

        try {
            const response = await axios.post('http://localhost:11434/api/generate', requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('Received response:', JSON.stringify(response.data, null, 2));
            
            let suggestion = response.data.response || '';
            
            // Remove code fence and language identifier
            suggestion = suggestion
                .replace(/^```\w*\n?/, '')  // Remove opening fence with optional language
                .replace(/```$/, '')         // Remove closing fence
                .trim();

            return suggestion;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('API error:', error.response?.status, error.response?.data);
            }
            throw error;
        }
    }

    dispose() {
        this.statusBarItem.dispose();
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
