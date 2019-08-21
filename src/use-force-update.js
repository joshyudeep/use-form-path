import React from 'react';

export const useForceUpdate = () => {
    const [, setCount] = React.useState(0);

    return () => {
        setCount((count) => count + 1);
    };
};
