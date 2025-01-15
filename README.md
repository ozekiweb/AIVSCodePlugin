![OZEKI](resources/ozeki-logo-1-soros-szines.webp)

# OZEKI AI Extension
## Introduction
**OZEKI AI Extension** is a useful Visual Studio Code extension for developers to use. This allows you to **talk to your OZEKI Chatbot inside Visual Studio Code**. This extension uses the **API key and the URL of your chatbot to send HTTP requests** using JSON body and convert the response to readable chat, so it can be read easily. 

*More information about the OZEKI AI Extension:* https://ozeki.chat/p_8676-ai-code-generation-vs-code-plugin.html

## OZEKI AI Chatbot
[OZEKI AI Chat](https://ozeki.chat/p_8474-setup-your-local-ai-llms-on-windows.html) offers a powerful and intuitive platform for creating your own custom chatbot using a model of your choice. Using OZEKI AI Studio, the users can easily build and personalize chatbots for their needs. The studio provides an easy-to-use interface that allows you to customize, and deploy your bot. Once created, you can interact with your chatbot directly through OZEKI AI Studio, or even use it in OZEKI Chat.

## Quick steps
**To use OZEKI AI Extension:**
- [Create your chatbot, and get your API url and key](https://ozeki.chat/p_8474-setup-your-local-ai-llms-on-windows.html)
- Download the extension from [Marketplace](https://marketplace.visualstudio.com/manage/publishers/nagygergely244/extensions/ozeki-ai/hub)
- Open VS Code and press CTRL + SHIFT + P and write: **Start Ozeki AI Chat**
- In the input add the API URL and key
- Start chatting with your bot 

## How to use the code
To use the code, you need to install **npm**:
```
npm install
```
This will read the package.json and install all required dependencies for the extension.
With this now you can now modify the code to your needs.
```
export function activate(context: vscode.ExtensionContext) {
    console.log('Ozeki Ai is now active!');

   // Check if the global storage folder exists, if not create it
    const globalStoragePath = context.globalStorageUri.fsPath;
    if (!fs.existsSync(globalStoragePath)) {
        console.log('No global storage folder found, creating a new one.');
        fs.mkdirSync(globalStoragePath, { recursive: true });
        console.log('Created new global storage folder');
    }

    // Check if settings file exists, if not create it
    const settingsPath = path.join(globalStoragePath, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        console.log('No settings.json file found, creating a new one.');
        const defaultSettings = { apiUrl: '', apiKey: '' };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
        console.log('Created new settings.json file');
        console.log('Settings path:', settingsPath);
    }

    // Load settings from settings.json file, or get input from user
    try {
        const fileContent = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(fileContent);
        console.log('Settings loaded from file:', settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
    }

    const createChatPanel = async () => {
        if (!settings || !settings.apiUrl || !settings.apiKey) {
            await showSettingsDialog(context);
        }

        const panel = vscode.window.createWebviewPanel(
            'ozekiAIChat',
            'Ozeki AI Chat',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        panel.webview.html = getWebviewContent();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'message':
                        try {
                            const response = await sendApiRequest(message.text);
                            panel.webview.postMessage({ 
                                type: 'response', 
                                text: response 
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage('Failed to send message: ' + error);
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    };

    let disposable = vscode.commands.registerCommand('ozeki-ai.startChat', createChatPanel);
    let settingsCommand = vscode.commands.registerCommand('ozeki-ai.settings', showSettingsDialog);
    context.subscriptions.push(disposable, settingsCommand);
    createChatPanel();
}

	// Show settings dialog to configure API URL and API Key, and save them to settings.json
async function showSettingsDialog(context: vscode.ExtensionContext) {
    const apiUrl = await vscode.window.showInputBox({
        prompt: 'Enter API URL',
        placeHolder: 'https://api.example.com/chat',
        value: settings?.apiUrl || ''
    });

    if (!apiUrl) {
        throw new Error('API URL is required');
    }

    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter API Key',
        placeHolder: 'your-api-key',
        value: settings?.apiKey || ''
    });

    if (!apiKey) {
        throw new Error('API Key is required');
    }
	
	const updatedApiUrl = `${apiUrl}?command=chatgpt`;
    settings = { apiUrl: updatedApiUrl, apiKey };
    const settingsPath = path.join(context.globalStorageUri.fsPath, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Settings saved to:', settingsPath);
    vscode.window.showInformationMessage('Settings saved successfully!');
}

	// Send a message to the API and return the response, formatted the response
async function sendApiRequest(message: string): Promise<string> {
	if (!settings) {
		throw new Error('Settings not configured');
	}

	try {
		const requestBody = {
			"model": "Nemotron-70B",
			"messages": [
				{
					"role": "system",
					"content": "Transcript of a conversation between the User and an Assistant. Assistant is a friendly, reliable, and highly knowledgeable assistant, known for being helpful, empathetic, and honest. Assistant consistently delivers prompt, clear, and accurate responses, excelling in writing and problem-solving, ensuring the User's requests are addressed with precision and care! Always sends clear messages with no bold or italic text."
				},
				{
					"role": "user",
					"content": message
				}
			],
			"temperature": 0.7,
			"max_completion_tokens": 100
		};

		console.log('Sending request to:', settings.apiUrl);
		console.log('Request body:', JSON.stringify(requestBody, null, 2));

		const response = await fetch(settings.apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${settings.apiKey}`
			},
			body: JSON.stringify(requestBody)
		});

		const responseBody = await response.text();
		console.log('Response status:', response.status);
		console.log('Response body:', responseBody);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}\nBody: ${responseBody}`);
		}

		try {
			const data = JSON.parse(responseBody);
			let formattedResponse = '';

			if (data.choices && data.choices[0]?.message?.content) {
				formattedResponse = data.choices[0].message.content;
			} else if (data.response) {
				// Try to parse the response as JSON if it's a string
				try {
					const parsedResponse = JSON.parse(data.response);
					formattedResponse = parsedResponse.message || parsedResponse.content || data.response;
				} catch {
					formattedResponse = data.response;
				}
			} else if (typeof data === 'string') {
				formattedResponse = data;
			} else {
				console.log('Unexpected response format:', data);
				formattedResponse = JSON.stringify(data, null, 2);
			}

			// Format the response, so it looks better in the chat
			formattedResponse = formattedResponse
				.replace(/\*\*/g, '')  
				.replace(/\\n/g, '\n')  
				.replace(/\n{3,}/g, '\n\n')  
				.trim();  

			return formattedResponse;
		} catch (parseError) {
			console.error('Failed to parse response:', parseError);
			return responseBody.replace(/\*\*/g, '').replace(/\\n/g, '\n').trim();
		}
	} catch (error) {
		console.error('API request failed:', error);
		throw error;
	}
}
```
## Manual
To get a better understanding about this **ai chat extension**, and see a visual and easy guide for install, please visit the webpage under this paragraph. This tutorial will help you with videos, and steps including screenshots to make sure you have an easy time to set it up.

Link to the tutorial: [OZEKI AI extension guide](https://ozeki.chat/p_8676-ai-code-generation-vs-code-plugin.html)

## How to transform your computer into a communcation server
[OZEKI Phone System](https://www.ozekiphone.com/) is a software for Windows that turns your computer into a communication server. It allows you to build applications such as PBX, VoIP gateway, IVR, and ACD, providing flexible and efficient communication solutions.

Here is a brief introduction for [OZEKI Phone System](https://www.ozekiphone.com/p_4523-introduction-to-ozeki-phone-system-xe-ip-pbx-software-for-windows.html).

## Get started now
Dont waste any more time. Download the extension and start your chat with your own AI Chatbot now!