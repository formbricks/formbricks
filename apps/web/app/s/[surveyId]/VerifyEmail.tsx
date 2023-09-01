"use client"
import React, { useState } from 'react'
import { EnvelopeIcon } from '@heroicons/react/24/solid'
import { Button, Input } from '@formbricks/ui'
import { Toaster, toast } from 'react-hot-toast'


export default function VerifyEmail({questions}) {
    const [previewQuestions, setpreviewQuestions] = useState(false)
    const [email, setEmail] = useState<string|null>(null)

    const validateEmail = (inputEmail) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(inputEmail);
    };

    const submitEmail =(email)=>{
        if(!validateEmail(email)){
            toast.error("Please enter a valid email")
            return
        }
        toast.success("Please enter a valid email")

    }
    return (
        <div className='bg-slate-50 h-full w-full flex items-center justify-center flex-col'>
            <Toaster />
            {!previewQuestions && <div className='flex flex-col items-center justify-center'>
                <EnvelopeIcon className='h-24 w-24 text-white bg-slate-300 p-6 rounded-full' />
                <p className='text-4xl font-bold mt-8'>Verify your email to respond.</p>
                <p className='text-slate-400 mt-2'>To respond to this survey please verify your email.</p>
                <div className='flex mt-6 space-x-2 w-full'>
                    <Input type='email' className='h-full' placeholder='user@gmail.com' value={email ? email : "" } onChange={(e)=>{setEmail(e.target.value)}}/>
                    <Button
                        variant="darkCTA"
                        onClick={() => {
                            submitEmail(email)
                        }}>
                        Verify
                    </Button>
                    
                </div>
                <p className='text-slate-400 text-sm cursor-pointer mt-6' onClick={()=>{setpreviewQuestions(true)}}>Just curious? Preview survey questions.</p>
            </div>}
            {previewQuestions && <div className='flex flex-col items-center justify-center w-1/3'>
                <p className='text-4xl font-bold'>Question Preview</p>
                <div className='flex flex-col justify-center border border-slate-200 w-full rounded-lg p-8 mt-4'>
                    {questions.map((question,index)=>{
                        return <p key={index} className='my-1'>{index+1}. {question.headline}</p>
                    })}
                     </div>
                     <p className='text-slate-400 text-sm cursor-pointer mt-6' onClick={()=>{setpreviewQuestions(false)}}>Want to respond? Verify email.</p>

                </div>}


        </div>
    )
}
