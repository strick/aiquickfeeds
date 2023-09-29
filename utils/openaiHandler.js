// openaiHandler.js

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function getOpenAIResponse(message) {

    const chatMessages = [];
    
    chatMessages.push(
        {
            "role": "system",
            "content": "You will be given text that is taken from an <article> tag of an AI RSS feed.  Your job is to summarize the article into three bullet points.  These bullets should not be longer than three sentences but should contain enough information to understand the article."
        }
    );

    chatMessages.push(
        {
            "role": "user",
            "content": message
        }
    );

    return await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: chatMessages,
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });
}

export { getOpenAIResponse };
