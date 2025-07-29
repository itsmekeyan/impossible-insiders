'use server';
/**
 * @fileOverview Fetches a craze score from YouTube based on a keyword.
 *
 * - fetchYoutubeCrazeScore - A function that fetches the craze score.
 * - FetchYoutubeCrazeScoreInput - The input type for the fetchYoutubeCrazeScore function.
 * - FetchYoutubeCrazeScoreOutput - The return type for the fetchYoutubeCrazeScore function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FetchYoutubeCrazeScoreInputSchema = z.object({
  keyword: z.string().describe('The keyword to search for on YouTube.'),
});
export type FetchYoutubeCrazeScoreInput = z.infer<typeof FetchYoutubeCrazeScoreInputSchema>;

const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  thumbnailUrl: z.string(),
  publishedAt: z.string(),
  viewCount: z.number(),
  likeCount: z.number(),
  commentCount: z.number(),
});

const FetchYoutubeCrazeScoreOutputSchema = z.object({
  crazeScore: z
    .number()
    .describe(
      'A score from 0-10 representing the craze level based on YouTube data.'
    ),
  videos: z.array(VideoSchema).describe('A list of top videos considered for the score.'),
});
export type FetchYoutubeCrazeScoreOutput = z.infer<typeof FetchYoutubeCrazeScoreOutputSchema>;

export async function fetchYoutubeCrazeScore(
  input: FetchYoutubeCrazeScoreInput
): Promise<FetchYoutubeCrazeScoreOutput> {
  return fetchYoutubeCrazeScoreFlow(input);
}

async function getYoutubeEngagement(keyword: string): Promise<FetchYoutubeCrazeScoreOutput> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not set. Please add it to your .env file.');
  }

  // Calculate the date from two weeks ago for the API query.
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const publishedAfter = twoWeeksAgo.toISOString();

  // 1. Search for videos related to the keyword, filtered by recent uploads and sorted by views.
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
    keyword
  )}&maxResults=5&order=viewCount&publishedAfter=${encodeURIComponent(publishedAfter)}&videoDuration=medium&key=${apiKey}`;

  try {
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('YouTube API Search Error:', errorText);
      throw new Error(`YouTube API search request failed: ${searchResponse.status} - ${errorText}`);
    }
    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      return { crazeScore: 0, videos: [] }; // No videos found
    }

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    
    // If no video IDs were found, there's nothing more to do.
    if (!videoIds) {
      return { crazeScore: 0, videos: [] };
    }

    // 2. Fetch statistics for the videos found.
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsResponse = await fetch(statsUrl);
    
    if (!statsResponse.ok) {
        const errorText = await statsResponse.text();
        console.error('YouTube API Videos Error:', errorText);
        throw new Error(`YouTube API videos request failed: ${statsResponse.status} - ${errorText}`);
    }

    const statsData = await statsResponse.json();

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    const videos = statsData.items?.map((item: any) => {
        const viewCount = parseInt(item.statistics?.viewCount || '0', 10);
        const likeCount = parseInt(item.statistics?.likeCount || '0', 10);
        const commentCount = parseInt(item.statistics?.commentCount || '0', 10);
        
        totalViews += viewCount;
        totalLikes += likeCount;
        totalComments += commentCount;
        
        return {
            id: item.id,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.default.url,
            publishedAt: item.snippet.publishedAt,
            viewCount,
            likeCount,
            commentCount
        };
    }) || [];
    
    // 3. Calculate a weighted engagement score. Likes are worth 5 views, and comments are worth 10 views.
    const engagementScore = (totalViews * 1) + (totalLikes * 5) + (totalComments * 10);
    
    console.log(`Totals - Views: ${totalViews}, Likes: ${totalLikes}, Comments: ${totalComments}, Weighted Score: ${engagementScore}`);
    
    if (engagementScore === 0) {
      return { crazeScore: 0, videos: videos };
    }
    
    // 4. Convert the raw engagement score to a 0-10 "craze score" using a logarithmic scale.
    // This prevents astronomical view counts from skewing the score too high and provides a more balanced measure.
    // The +1 ensures we don't take the log of 0.
    const crazeMultiplier = Math.log10(engagementScore + 1); 
    const crazeScore = Math.min(10, crazeMultiplier); // Cap the score at 10.
    
    console.log(`Total engagement score: ${engagementScore}, Calculated craze score: ${crazeScore.toFixed(2)}`);
    return { crazeScore: parseFloat(crazeScore.toFixed(2)), videos };

  } catch (error) {
    console.error('Error fetching from YouTube API:', error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch YouTube data: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching YouTube data.');
  }
}

const fetchYoutubeCrazeScoreFlow = ai.defineFlow(
  {
    name: 'fetchYoutubeCrazeScoreFlow',
    inputSchema: FetchYoutubeCrazeScoreInputSchema,
    outputSchema: FetchYoutubeCrazeScoreOutputSchema,
  },
  async ({ keyword }) => {
    console.log('Fetching YouTube craze score for keyword:', keyword);
    return getYoutubeEngagement(keyword);
  }
);
