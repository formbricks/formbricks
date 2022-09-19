import React from 'react';
import { useRouter } from "next/router";

function Page() {
    const router = useRouter();

    const pageId = router.query.pageId?.toString();

    console.log(pageId);
    

    return (
        <div>Page</div>
    )
}

export default Page