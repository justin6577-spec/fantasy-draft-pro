/**
 * LLM News Summarizer — takes raw article text and produces a fantasy-football
 * relevant summary with impact tag.
 */

import { prisma } from '../../lib/prisma';

interface SummarizedResult {
  summaryText: string;
  impactTag: 'out' | 'questionable' | 'role_change' | 'breakout' | 'neutral';
}

/**
 * Summarizes a batch of raw articles for a player using OpenAI.
 * Falls back to a simple concatenation if the API key is not configured.
 */
export async function summarizeArticles(
  playerId: string,
  articles: Array<{ id: string; sourceUrl: string; publishedAt: Date; rawText: string }>,
): Promise<SummarizedResult> {
  if (articles.length === 0) {
    return { summaryText: 'No recent news.', impactTag: 'neutral' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: return raw text concatenation
    const text = articles.slice(0, 3).map((a) => a.rawText.slice(0, 300)).join(' | ');
    return { summaryText: text || 'No recent news.', impactTag: 'neutral' };
  }

  try {
    const articleText = articles
      .slice(0, 5)
      .map((a) => `[${a.publishedAt.toISOString().slice(0, 10)}] ${a.rawText.slice(0, 500)}`)
      .join('\n\n');

    const prompt = `You are a fantasy football news analyst. Summarize the following news articles for a fantasy football player into ONE concise paragraph (2-3 sentences). Focus on fantasy-relevant impact.

Then assign ONE impact tag:
- "out" — player is ruled out / injured / suspended
- "questionable" — uncertainty about playing time or role
- "role_change" — promotion, demotion, trade, or depth chart move
- "breakout" — exceptional performance, increased usage, clear path to targets/carries
- "neutral" — no clear fantasy impact

Respond in this format:
SUMMARY: <your summary>
TAG: <tag>

Articles:
${articleText}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!res.ok) throw new Error(`LLM API error: ${res.status}`);

    const data = (await res.json()) as any;
    const text: string = data?.choices?.[0]?.message?.content ?? '';

    // Parse structured response
    const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?:\n|$)/i);
    const tagMatch = text.match(/TAG:\s*(out|questionable|role_change|breakout|neutral)/i);

    return {
      summaryText: summaryMatch?.[1]?.trim() ?? (articles[0]?.rawText.slice(0, 300) ?? 'No recent news.'),
      impactTag: (tagMatch?.[1] as SummarizedResult['impactTag']) ?? 'neutral',
    };
  } catch {
    return { summaryText: articles[0]?.rawText.slice(0, 300) ?? 'No recent news.', impactTag: 'neutral' };
  }
}

/**
 * Generates or retrieves a cached summary for a player, persisting to DB.
 */
export async function getOrCreateSummary(playerId: string): Promise<{
  summaryText: string;
  impactTag: string;
  generatedAt: string;
  status: 'ok' | 'no_recent_news';
}> {
  // Check for existing summary (generated within the last hour)
  const existing = await prisma.newsSummary.findFirst({
    where: {
      playerId,
      generatedAt: { gte: new Date(Date.now() - 3600_000) }, // 1 hour
    },
    orderBy: { generatedAt: 'desc' },
  });

  if (existing) {
    return {
      summaryText: existing.summaryText,
      impactTag: existing.impactTag,
      generatedAt: existing.generatedAt.toISOString(),
      status: 'ok',
    };
  }

  // Fetch recent articles from the DB
  const articles = await prisma.newsArticle.findMany({
    where: { playerId },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  });

  if (articles.length === 0) {
    return { summaryText: '', impactTag: 'neutral', generatedAt: '', status: 'no_recent_news' };
  }

  // Generate summary
  const result = await summarizeArticles(playerId, articles);

  // Persist
  const clusterId = `cluster_${playerId}_${Date.now()}`;
  await prisma.newsSummary.create({
    data: {
      articleClusterId: clusterId,
      playerId,
      summaryText: result.summaryText,
      impactTag: result.impactTag,
      citedSources: articles.slice(0, 3).map((a) => ({
        url: a.sourceUrl,
        publishedAt: a.publishedAt.toISOString(),
      })),
      articleId: articles[0]?.id ?? null,
    },
  });

  return {
    summaryText: result.summaryText,
    impactTag: result.impactTag,
    generatedAt: new Date().toISOString(),
    status: 'ok',
  };
}
