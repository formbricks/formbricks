"use client";

import {
  getPersonAttributesAction,
  getPersonsAction,
} from "@/app/(app)/environments/[environmentId]/(people)/people/actions";
import { PersonTable } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonTable";
import { useEffect, useState } from "react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TPerson, TPersonTableData } from "@formbricks/types/people";

interface PersonDataViewProps {
  environment: TEnvironment;
  personCount: number;
  itemsPerPage: number;
}

export const PersonDataView = ({ environment, personCount, itemsPerPage }: PersonDataViewProps) => {
  const [persons, setPersons] = useState<TPerson[]>([]);
  const [personTableData, setPersonTableData] = useState<TPersonTableData[]>([]);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalPersons, setTotalPersons] = useState<number>(0);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);

  useEffect(() => {
    setTotalPersons(personCount);
    setHasMore(pageNumber < Math.ceil(personCount / itemsPerPage));

    const fetchData = async () => {
      try {
        const getPersonActionData = await getPersonsAction({
          environmentId: environment.id,
          page: pageNumber,
        });
        if (getPersonActionData?.data) {
          setPersons(getPersonActionData.data);
        }
      } catch (error) {
        console.error("Error fetching people data:", error);
      }
    };

    fetchData();
  }, [pageNumber, personCount, itemsPerPage, environment.id]);

  // Fetch additional person attributes and update table data
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const updatedPersonTableData = await Promise.all(
          persons.map(async (person) => {
            const attributes = await getPersonAttributesAction({
              environmentId: environment.id,
              personId: person.id,
            });
            return {
              createdAt: person.createdAt,
              personId: person.id,
              userId: person.userId,
              email: attributes?.data?.email ?? "",
              attributes: attributes?.data ?? {},
            };
          })
        );
        setPersonTableData(updatedPersonTableData);
      } catch (error) {
        console.error("Error fetching person attributes:", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    fetchAttributes();
  }, [persons, environment.id]);

  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      const getPersonsActionData = await getPersonsAction({
        environmentId: environment.id,
        page: pageNumber,
      });
      if (getPersonsActionData?.data) {
        const newData = getPersonsActionData.data;
        setPersons((prevPersonsData) => [...prevPersonsData, ...newData]);
      }
      setPageNumber((prevPage) => prevPage + 1);
      setHasMore(pageNumber + 1 < Math.ceil(totalPersons / itemsPerPage));
      setLoadingNextPage(false);
    }
  };

  const deletePersons = (personIds: string[]) => {
    setPersons((prevPersons) => prevPersons.filter((p) => !personIds.includes(p.id)));
  };

  return (
    <PersonTable
      data={personTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isDataLoaded}
      deletePersons={deletePersons}
      environmentId={environment.id}
    />
  );
};
