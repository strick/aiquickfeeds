// openaiHandler.js

import OpenAI from 'openai';

async function getOpenAIResponse(message) {

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const chatMessages = [];
    
    chatMessages.push(
        {
            "role": "system",
            "content":  process.env.SYSTEM_PROMPT 
        }
    );

    chatMessages.push(
        {
            "role": "user",
            "content": message
        }
    );

    try {
        let responseMessage = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-16k",
            messages: chatMessages,
            temperature: 1,
            max_tokens: 256,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

           
        return responseMessage.choices[0].message.content;
    }
    catch (error) {
        return false;
    }
 
}

export { getOpenAIResponse };
