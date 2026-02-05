import React, { createContext, useState, useContext } from 'react';
import { getLocalDate } from '../database/db';

const DateContext = createContext();

export const DateProvider = ({ children }) => {
  // Default date is Today
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
};

export const useDate = () => useContext(DateContext);
