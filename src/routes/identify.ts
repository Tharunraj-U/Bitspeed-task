import { Request, Response } from "express";
import prisma from "../prismaClient";

interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

interface ContactResponse {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

/**
 * Find the root primary contact by following linkedId chain.
 */
async function findPrimaryContact(contactId: number): Promise<number> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return contactId;
  if (contact.linkedId === null) return contact.id;
  return findPrimaryContact(contact.linkedId);
}

/**
 * Build the consolidated response for a given primary contact ID.
 */
async function buildResponse(primaryId: number): Promise<ContactResponse> {
  const primary = await prisma.contact.findUnique({
    where: { id: primaryId },
  });

  if (!primary) {
    throw new Error(`Primary contact with id ${primaryId} not found`);
  }

  const secondaries = await prisma.contact.findMany({
    where: { linkedId: primaryId },
    orderBy: { createdAt: "asc" },
  });

  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  // Primary contact info comes first
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  // Add secondary contacts' info
  for (const sec of secondaries) {
    secondaryContactIds.push(sec.id);
    if (sec.email && !emails.includes(sec.email)) {
      emails.push(sec.email);
    }
    if (sec.phoneNumber && !phoneNumbers.includes(sec.phoneNumber)) {
      phoneNumbers.push(sec.phoneNumber);
    }
  }

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

export async function identifyHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Normalize: treat empty strings as null
    const normalizedEmail = email?.trim() || null;
    const normalizedPhone = phoneNumber?.toString().trim() || null;

    // Must have at least one of email or phoneNumber
    if (!normalizedEmail && !normalizedPhone) {
      res.status(400).json({
        error: "At least one of email or phoneNumber must be provided",
      });
      return;
    }

    // Step 1: Find all existing contacts matching email OR phoneNumber
    const conditions: any[] = [];
    if (normalizedEmail) {
      conditions.push({ email: normalizedEmail });
    }
    if (normalizedPhone) {
      conditions.push({ phoneNumber: normalizedPhone });
    }

    const matchingContacts = await prisma.contact.findMany({
      where: { OR: conditions },
      orderBy: { createdAt: "asc" },
    });

    // Step 2: No matches — create a new primary contact
    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          linkPrecedence: "primary",
        },
      });

      res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber
            ? [newContact.phoneNumber]
            : [],
          secondaryContactIds: [],
        },
      });
      return;
    }

    // Step 3: Resolve all matching contacts to their primary IDs
    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
      const primaryId = await findPrimaryContact(contact.id);
      primaryIds.add(primaryId);
    }

    // Get unique primaries sorted by creation date
    const primaries = await prisma.contact.findMany({
      where: { id: { in: Array.from(primaryIds) } },
      orderBy: { createdAt: "asc" },
    });

    // The oldest primary becomes THE primary
    const mainPrimary = primaries[0];

    // Step 4: If there are multiple primary groups, merge them
    if (primaries.length > 1) {
      for (let i = 1; i < primaries.length; i++) {
        const otherPrimary = primaries[i];

        // Turn the newer primary into a secondary of the oldest primary
        await prisma.contact.update({
          where: { id: otherPrimary.id },
          data: {
            linkedId: mainPrimary.id,
            linkPrecedence: "secondary",
            updatedAt: new Date(),
          },
        });

        // Re-link all secondaries of the other primary to the main primary
        await prisma.contact.updateMany({
          where: { linkedId: otherPrimary.id },
          data: {
            linkedId: mainPrimary.id,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Step 5: Check if we need to create a new secondary contact
    // Only if the request brings NEW information not already in the group
    if (normalizedEmail && normalizedPhone) {
      // Fetch ALL contacts in this primary group after merging
      const allGroupContacts = await prisma.contact.findMany({
        where: {
          OR: [{ id: mainPrimary.id }, { linkedId: mainPrimary.id }],
        },
      });

      const existingEmails = new Set(
        allGroupContacts.map((c) => c.email).filter(Boolean)
      );
      const existingPhones = new Set(
        allGroupContacts.map((c) => c.phoneNumber).filter(Boolean)
      );

      const emailExists = existingEmails.has(normalizedEmail);
      const phoneExists = existingPhones.has(normalizedPhone);

      // Check if exact combination already exists
      const exactMatch = allGroupContacts.some(
        (c) =>
          c.email === normalizedEmail && c.phoneNumber === normalizedPhone
      );

      // Create secondary only if we have new info and no exact match
      if (!exactMatch && (!emailExists || !phoneExists)) {
        await prisma.contact.create({
          data: {
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
            linkedId: mainPrimary.id,
            linkPrecedence: "secondary",
          },
        });
      }
    }

    // Step 6: Build and return the consolidated response
    const response = await buildResponse(mainPrimary.id);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in /identify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
