import React from 'react';
import { OrderStatus, LocationCoordinates } from '../../types';
import { RealInteractiveMap } from './RealInteractiveMap';

interface SimulatedMapProps {
  status: OrderStatus;
  storeName: string;
  storeAddress: string;
  customerAddress: string;
  courierName?: string;
  courierVehicle?: string;
  customerCoordinates?: LocationCoordinates;
  courierLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    updatedAt: string;
    isSharingEnabled: boolean;
  };
}

/**
 * Clean replacement for SimulatedMap that eliminates fake trails and displays real coordinates,
 * geofence boundaries in Iraq, and explicit courier GPS consent status.
 */
export const SimulatedMap: React.FC<SimulatedMapProps> = ({
  status,
  storeName,
  storeAddress,
  customerAddress,
  courierName,
  customerCoordinates,
  courierLocation,
}) => {
  return (
    <RealInteractiveMap
      status={status}
      storeName={storeName}
      storeAddress={storeAddress}
      customerAddress={customerAddress}
      courierName={courierName}
      customerCoordinates={customerCoordinates}
      courierLocation={courierLocation}
      isInteractivePicker={false}
    />
  );
};
