import * as fs from 'fs';
import * as path from 'path';

export class ChatLogger {
    private logPath: string;

    constructor(storagePath: string) {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        this.logPath = path.join(storagePath, `ozeki-chat-${today}.log`);
        
        // Ensure the directory exists
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    public logMessage(message: string, isUser: boolean = false) {
        const timestamp = new Date().toISOString();
        const sender = isUser ? 'User' : 'Assistant';
        const logEntry = `[${timestamp}] ${sender}: ${message}\n`;

        try {
            fs.appendFileSync(this.logPath, logEntry);
        } catch (error) {
            console.error('Failed to log chat message:', error);
        }
    }

    public logRating(rating: number, feedback: string = '') {
        const timestamp = new Date().toISOString();
        const logEntry = `\n[${timestamp}] Chat Rating: ${rating}/5 stars\n`;
        const feedbackEntry = feedback ? `Feedback: ${feedback}\n` : '';

        try {
            fs.appendFileSync(this.logPath, logEntry + feedbackEntry + '\n');
        } catch (error) {
            console.error('Failed to log rating:', error);
        }
    }
} 