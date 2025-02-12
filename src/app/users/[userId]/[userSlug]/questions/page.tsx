import Pagination from '@/components/Pagination';
import QuestionCard from '@/components/QuestionCard';
import {
  answerCollection,
  db,
  questionCollection,
  voteCollection
} from '@/models/name';
import { databases, users } from '@/models/server/config';
import { UserPrefs } from '@/store/Auth';
import { Query } from 'node-appwrite';
import React from 'react';

const Page = async ({
  params,
  searchParams
}: {
  params: { userId: string; userSlug: string };
  searchParams: { page?: string };
}) => {
  try {
    searchParams.page ||= '1';

    console.log('Fetching questions for user:', params.userId, 'Page:', searchParams.page);

    const queries = [
      Query.equal('authorId', params.userId),
      Query.orderDesc('$createdAt'),
      Query.offset((+searchParams.page - 1) * 25),
      Query.limit(25)
    ];

    const questions = await databases.listDocuments(db, questionCollection, queries);
    console.log('Fetched Questions:', questions);

    if (!questions.documents.length) {
      console.warn('No questions found for user:', params.userId);
      return <div className="px-4"><p>No questions found for this user.</p></div>;
    }

    const updatedQuestions = await Promise.all(
      questions.documents.map(async (ques) => {
        try {
          const [author, answers, votes] = await Promise.all([
            users.get<UserPrefs>(ques.authorId).catch(() => null),
            databases.listDocuments(db, answerCollection, [
              Query.equal('questionId', ques.$id),
              Query.limit(1)
            ]).catch(() => ({ total: 0 })),
            databases.listDocuments(db, voteCollection, [
              Query.equal('type', 'question'),
              Query.equal('typeId', ques.$id),
              Query.limit(1)
            ]).catch(() => ({ total: 0 }))
          ]);

          if (!author) return null; // Ignore questions with no valid author

          return {
            ...ques,
            totalAnswers: answers.total || 0,
            totalVotes: votes.total || 0,
            author: {
              $id: author.$id,
              reputation: author.prefs?.reputation || 0,
              name: author.name || 'Unknown'
            }
          };
        } catch (error) {
          console.error('Error processing question:', error);
          return null;
        }
      })
    );

    // Filter out `null` values
    const validQuestions = updatedQuestions.filter(Boolean) as typeof questions.documents;

    return (
      <div className='px-4'>
        <div className='mb-4'>
          <p>{validQuestions.length} questions</p>
        </div>
        <div className='mb-4 max-w-3xl space-y-6'>
          {validQuestions.map(ques => (
            <QuestionCard key={ques.$id} ques={ques} />
          ))}
        </div>
        <Pagination total={questions.total} limit={25} />
      </div>
    );
  } catch (error) {
    console.error('Error fetching questions:', error);
    return <div className='px-4 text-red-500'>Error loading questions. Please try again later.</div>;
  }
};

export default Page;
