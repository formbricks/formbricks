import React from 'react'
import {ChevronDoubleDownIcon} from '@heroicons/react/20/solid'
import { XCircleIcon } from '@heroicons/react/20/solid'

export default function QuestionSkip({ skippedQuestions, status, questions }) {
    return (
        <>
            {skippedQuestions && <div className="flex w-full p-2 text-slate-400 text-sm">
                {status === "skipped" && <div className='flex'>
                    <div className="w-0.5 flex items-center justify-center"
                        style={{
                            background: 'repeating-linear-gradient(to bottom,   rgb(148 163 184),  rgb(148 163 184) 8px, transparent 5px, transparent 15px)' // adjust the values to fit your design
                        }}
                    >
                        {skippedQuestions.length > 1 && <ChevronDoubleDownIcon className='w-[1.25rem] min-w-[1.25rem] bg-slate-500 text-white rounded-full' />}

                    </div>
                    <div className="ml-6 flex flex-col">
                        {skippedQuestions && skippedQuestions.map((questionId) => {
                            return <p className="my-2">{questions.find((question) => question.id === questionId).headline}</p>
                        })}
                    </div>
                </div>}
                {status === "aborted" && <div className='flex'><div
                    className="w-0.5 flex-grow flex items-start justify-center"
                    style={{
                        background: 'repeating-linear-gradient(to bottom,  rgb(148 163 184),  rgb(148 163 184) 2px, transparent 2px, transparent 10px)' // adjust the 2px to change dot size and 10px to change space between dots
                    }}
                >
                    <div className='flex'>
                        <XCircleIcon className='min-w-[1.5rem] min-h-[1.5rem] text-slate-500 bg-white rounded-full' />
                    </div>
                </div>
                    <div className="ml-4 flex flex-col mb-2">
                        <p className="rounded-lg text-slate-700 bg-slate-100 px-2 w-fit mb-2">closed</p>
                        {skippedQuestions && skippedQuestions.map((questionId) => {
                            return <p className="my-2">{questions.find((question) => question.id === questionId).headline}</p>
                        })}
                    </div>
                </div>}
            </div>}
        </>
    )
}
