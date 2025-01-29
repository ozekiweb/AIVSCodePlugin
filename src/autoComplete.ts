import * as vscode from 'vscode';

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

        // Set new timeout
        this.timeout = setTimeout(async () => {
            await this.provideSuggestion(editor);
        }, 4000);
    }

    private async provideSuggestion(editor: vscode.TextEditor) {
        if (!this.lastPosition) return;

        const document = editor.document;
        const textBeforeCursor = document.getText(new vscode.Range(
            new vscode.Position(0, 0),
            this.lastPosition
        ));

        try {
            const suggestion = await this.getCodeSuggestion(textBeforeCursor);
            if (suggestion) {
                this.lastSuggestion = suggestion;
                editor.setDecorations(this.decorationType, [{
                    range: new vscode.Range(
                        this.lastPosition,
                        this.lastPosition
                    ),
                    renderOptions: {
                        after: {
                            contentText: suggestion
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
        if (!editor || !this.lastPosition) return;

        const currentPos = editor.selection.active;
        const ghostText = this.lastSuggestion;

        if (ghostText) {
            await editor.edit(editBuilder => {
                editBuilder.insert(currentPos.translate(0, currentPos.character), ghostText);
            });
        }
        editor.setDecorations(this.decorationType, []);
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
            prompt: `${prefix_code}`,
            suffix: `${suffix_code}`,
            stream: false
        };

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as OllamaResponse;
        return data.response || '';
    }

    dispose() {
        this.statusBarItem.dispose();
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
