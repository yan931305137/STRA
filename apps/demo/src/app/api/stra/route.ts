/**
 * /api/stra - STRA Runtime Health Check & Info
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'STRA Demo',
    version: '0.1.0',
    description: 'Semantic Tree Runtime + AI - Product Showcase',
    showcases: ['ai-copilot', 'analytics-dashboard', 'action-flow'],
    packages: ['@stra/types', '@stra/core', '@stra/react', '@stra/renderer-core', '@stra/dom', '@stra/renderer-html'],
  });
}
