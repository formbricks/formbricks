import { getSessionOrUser } from "@/lib/apiHelper";
import { verifyInviteToken } from "@/lib/jwt";
import type { NextApiRequest, NextApiResponse } from "next";
import { GetServerSideProps } from "next";

function JoinTeam(props: { status: string }) {
    console.log(props)
    return (
        <div>
            <h1>Join Team</h1>
            <p>Status: {props.status}</p>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    // const { req, res, query } = context;
    // const user = await getSessionOrUser(req as NextApiRequest, res as NextApiResponse);

    // const token = query.token as string;
    // let inviteData = null;
    // let status = "";

    // try {
    //     inviteData = await verifyInviteToken(token);
    // } catch (error) {
    //     status = "inviteExpired";
    // }

    // if (user) {
    //     if (user.email === inviteData.email) {
    //         status = "loggedIn";
    //     } else {
    //         status = "emailMismatch";
    //     }
    // } else {
    //     status = "notLoggedIn";
    // }

    // if (inviteData && inviteData.used) {
    //     status = "inviteUsed";
    // }

    return {
        props: {
            status: "hallo",
        },
    };
};

export default JoinTeam;
