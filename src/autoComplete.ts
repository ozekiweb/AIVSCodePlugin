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

        // Create axios instance 
        const api = axios.create({
            baseURL: 'http://localhost:11434',
            timeout: 10000,  
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const document = editor.document;
        const prefix_code = document.getText(new vscode.Range(
            new vscode.Position(0, 0),
            this.lastPosition
        ));

        // Only get suffix if needed
        const suffix_code = document.getText(new vscode.Range(
            this.lastPosition,
            document.lineAt(document.lineCount - 1).range.end
        ));

        const requestBody = {
            model: "qwen2.5-coder:1.5b",
            system: "You are a code completion assistant. Complete the code concisely.",
            prompt: `${prefix_code}${suffix_code}`,
            temperature: 0.1,
            max_tokens: 30,
            stream: false,
            stop: ["#", "//", "```"],
            cache: true 
        };

        try {
            const { data } = await api.post('/api/generate', requestBody);
            return (data.response || '').replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
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
