# Bitespeed Identity Reconciliation Service

A backend web service for Bitespeed's Identity Reconciliation task. This service identifies and links customer contacts across multiple purchases using different email addresses and phone numbers.

## 🚀 Live Endpoint

**Base URL:** `https://bitespeed-assignment-pink.vercel.app`

**POST** `/identify`

## 📋 API Usage

### POST `/identify`

**Request Body (JSON):**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Rules
- At least one of `email` or `phoneNumber` must be provided.
- If no existing contact matches, a new **primary** contact is created.
- If the request shares an email or phone with existing contacts but brings new information, a **secondary** contact is created and linked to the primary.
- If two separate primary contact groups are linked by a new request, the **older** primary remains primary and the newer one becomes secondary.

## 🛠️ Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Deployment:** Vercel (Serverless Functions)

## 📦 Local Development

### Prerequisites
- Node.js >= 18
- PostgreSQL database (local or cloud, e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com))

### Setup

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Tharunraj-U/Bitspeed-task.git
   cd Bitspeed-task
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
   ```

4. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the dev server:**
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`.

## 🚢 Deployment (Vercel)

1. Push your code to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add `DATABASE_URL` as an environment variable in Vercel project settings.
4. Vercel will auto-detect the `vercel.json` config and deploy.

## 📂 Project Structure

```
├── api/
│   └── index.ts          # Vercel serverless entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── src/
│   ├── app.ts            # Express app setup
│   ├── index.ts           # Local server entry point
│   ├── prismaClient.ts   # Prisma client singleton
│   └── routes/
│       └── identify.ts   # /identify endpoint handler
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```
