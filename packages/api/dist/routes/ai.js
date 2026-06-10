"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = (0, express_1.Router)();
const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
router.post('/chat', async (req, res) => {
    try {
        const { messages, system } = req.body;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: system || 'You are a helpful family assistant. Be friendly, brief, and kid-appropriate.',
            messages
        });
        res.json({ text: response.content[0].text });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=ai.js.map