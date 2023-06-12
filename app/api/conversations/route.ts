import getCurrentUser from "@/app/actions/getCurrentUser";
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";

export async function POST(
  request: Request
) {
  try {
    const currentUser = await getCurrentUser()
    const body = await request.json()
    const {
      userId,
      isGroup,
      members,
      name
    } = body

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (isGroup && (!members || members.length < 2 || !name)) {
      return new NextResponse('Invalid data', { status: 400 })
    }

    if (isGroup) {
      const newConversation = await prisma.conversation.create({
        data: {
          name,
          isGroup,
          users: {
            connect: [
              // Iterate to get userIds
              // userIds will be stored in Conversation.userIds
              // ID of conversation will also be stored in each User.conversationIds 
              ...members.map((member: { value: string }) => ({
                id: member.value
              })),

              // Separately add current user
              // Filter current user from list of possible users to add in group chat
              {
                id: currentUser.id
              }
            ]
          }
        },
        include: {
          // Populate userIds with users information
          users: true
        }
      })

      return NextResponse.json(newConversation)
    }

    // Check if an existing Conversation already exist between current user and this other user
    const existingConversations = await prisma.conversation.findMany({
      where: {
        OR: [
          {
            userIds: {
              equals: [currentUser.id, userId]
            }
          },
          {
            userIds: {
              equals: [userId, currentUser.id]
            }
          }
        ]
      }
    })

    const singleConversation = existingConversations[0]

    if (singleConversation) {
      return NextResponse.json(singleConversation)
    }

    const newConversation = await prisma.conversation.create({
      data: {
        users: {
          connect: [
            {
              id: currentUser.id
            },
            {
              id: userId
            }
          ]
        }
      },
      include: {
        users: true
      }
    })

    return NextResponse.json(newConversation)
  
  } catch (error: any) {
    return new NextResponse('Interna; Error', { status: 500 })
  }
}