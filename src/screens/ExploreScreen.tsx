import React, { useState } from 'react';
import ExplorePgs from './ExplorePgs';
import PgDetails from './PgDetails';

export default function ExploreScreen() {
  const [selectedPgId, setSelectedPgId] = useState<number | null>(null);

  if (selectedPgId !== null) {
    return (
      <PgDetails
        pgId={selectedPgId}
        onBack={() => setSelectedPgId(null)}
      />
    );
  }

  return (
    <ExplorePgs
      onSelectPg={(id) => setSelectedPgId(id)}
    />
  );
}
