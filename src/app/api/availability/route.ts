import { NextRequest, NextResponse } from 'next/server';
import { getTickets, getTimeSlots, getBookedQuantities, cleanupExpiredHolds } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Date query parameter is required (e.g. ?date=Oct+26)' }, { status: 400 });
    }

    // Clean up expired holds older than 2 minutes
    await cleanupExpiredHolds(2);

    const tickets = getTickets().filter(t => t.active === 1);
    const slots = getTimeSlots().filter(s => s.active === 1);

    const availabilityData = slots.map(slot => {
      const bookedQuantities = getBookedQuantities(date, slot.label);
      const bookedMap = new Map(bookedQuantities.map(b => [b.ticket_id, b.total_booked]));

      const ticketAvailabilities = tickets.map(ticket => {
        const booked = bookedMap.get(ticket.id) || 0;
        const available = Math.max(0, ticket.capacity - booked);
        return {
          ticketId: ticket.id,
          ticketName: ticket.name,
          capacity: ticket.capacity,
          booked,
          available,
          isSoldOut: available === 0
        };
      });

      return {
        timeSlot: slot.label,
        startHour: slot.start_hour,
        endHour: slot.end_hour,
        tickets: ticketAvailabilities
      };
    });

    return NextResponse.json({
      date,
      slots: availabilityData
    });
  } catch (err: any) {
    console.error('Error in availability route:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch availability' }, { status: 500 });
  }
}
